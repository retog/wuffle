
let enabled = true;

function toggle(_enabled) {
  if (typeof _enabled !== 'undefined') {
    enabled = _enabled;
  } else {
    enabled = !enabled;
  }

  console.log('ANIMATE', enabled);
}

export { enabled, toggle }