const {
  Cache
} = require('../../util');

// 8 hours
const TTL = 1000 * 60 * 60 * 8;


function GithubRepositories(logger, events, githubClient) {

  const log = logger.child({
    name: 'wuffle:github-repositories'
  });

  const cache = new Cache(TTL);


  function fetchIssueTemplates(repo, owner) {

    return (
      githubClient.getOrgScoped(owner)
        .then(github => {
          return Promise.all(
            [
              'ISSUE_TEMPLATE.md',
              '.github/ISSUE_TEMPLATE.md',
              '.github/ISSUE_TEMPLATE'
            ].map(path => {
              return github.repos.getContents({
                repo,
                owner,
                path
              }).catch(err => {
                if (err.status !== 404) {
                  log.warn('failed to retrieve file', { repo, owner, path }, err);
                }

                return null;
              });
            })
          );
        })
        .then(files => files.some(f => f))
        .catch(err => {
          log.warn('failed to fetch templates', { repo, owner }, err);

          return false;
        })
    );
  }

  function hasIssueTemplates(repo, owner) {
    return cache.get(`${repo}/${owner}`, () => fetchIssueTemplates(repo, owner));
  }


  // api ////////////////////

  this.hasIssueTemplates = hasIssueTemplates;


  // behavior ///////////////

  if (process.env.NODE_ENV !== 'test') {

    events.once('wuffle.start', function() {
      setInterval(() => {
        cache.evict();
      }, 1000 * 10);
    });
  }

}

module.exports = GithubRepositories;