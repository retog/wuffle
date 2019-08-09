const {
  Cache
} = require('../../util');

// 10 minutes
const TTL = 1000 * 60 * 10;


/**
 * This component provides the functionality to filter
 * issues based on user views.
 *
 * @param {Logger} logger
 * @param {GitHubClient} githubClient
 * @param {Events} events
 */
function UserAccess(logger, githubClient, events) {

  const log = logger.child({
    name: 'wuffle:user-access'
  });

  const cache = new Cache(TTL);

  function getRepository(issue) {
    const {
      key,
      repository
    } = issue;

    if (!repository) {
      throw new Error(`missing repository meta-data for issue (key=${ key })`);
    }

    return repository;
  }

  /**
   * Show publicly accessible issues only.
   */
  function filterPublic(issue) {
    return !getRepository(issue).private;
  }

  /**
   * Filter issues and PRs that are member of the given
   * repositories.
   */
  async function createMemberFilter(repositories) {

    const repositoryMap = repositories.reduce((map, repo) => {

      map[repo] = true;

      return map;
    }, {});

    return function filterPrivate(issue) {

      if (filterPublic(issue)) {
        return true;
      }

      const repository = getRepository(issue);

      return fullName(repository) in repositoryMap;
    };
  }

  function createReadFilter(token) {

    log.info({ token }, 'creating read filter');

    return githubClient.getUserScoped(token)
      .then(github => {
        return github.paginate(
          github.repos.list.endpoint.merge({
            visibility: 'private'
          }),
          res => res.data
        );
      }).then(repositories => {
        const repositoryNames = repositories.map(fullName);

        log.debug({
          token,
          repositories: repositoryNames
        }, 'creating member filter');

        return createMemberFilter(repositoryNames);
      });
  }

  function fetchPermissionLevel(username, repo, owner) {
    return (
      githubClient.getOrgScoped(owner)
        .then(github => github.repos.getCollaboratorPermissionLevel({
          repo,
          owner,
          username
        }))
        .then(res => res.data.permission)
        .catch(err => {
          log.warn('failed to fetch permissions', { username, owner, repo }, err);

          return 'none';
        })
    );
  }

  function getReadFilter(token) {

    if (!token) {
      return Promise.resolve(filterPublic);
    }

    return cache.get(`read-filter:${token}`, createReadFilter).catch(err => {
      log.warn({ token }, 'failed to retrieve token-based access filter, defaulting to public read', err);

      return filterPublic;
    });
  }

  async function getPermission(username, repo, owner) {
    const key = `permissions:${username}:${repo}/${owner}`;

    return cache.get(key, () => fetchPermissionLevel(username, repo, owner));
  }

  function canRead(username, repoAndOwner) {

    const {
      repo,
      owner
    } = repoAndOwner;

    return getPermission(username, repo, owner).then(permission => {
      return (
        permission === 'read' ||
        permission === 'write' ||
        permission === 'admin'
      );
    });
  }

  function canWrite(username, repoAndOwner) {

    const {
      repo,
      owner
    } = repoAndOwner;

    return getPermission(username, repo, owner).then(permission => {
      return (
        permission === 'write' ||
        permission === 'admin'
      );
    });
  }


  // api ////////////////////

  this.getReadFilter = getReadFilter;

  this.canWrite = canWrite;
  this.canRead = canRead;


  // behavior ///////////////

  if (process.env.NODE_ENV !== 'test') {

    events.once('wuffle.start', function() {
      setInterval(() => {
        cache.evict();
      }, 1000 * 10);
    });
  }

}

module.exports = UserAccess;


// helpers //////////////

function fullName(repository) {
  return `${repository.owner.login}/${repository.name}`;
}