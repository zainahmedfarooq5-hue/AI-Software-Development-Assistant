const { execSync } = require('child_process');

function gitInit(projectPath) {
  try {
    execSync('git init', { cwd: projectPath, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function gitAdd(projectPath, files = '.') {
  try {
    execSync(`git add ${files}`, { cwd: projectPath, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function gitCommit(projectPath, message = 'Initial commit') {
  try {
    execSync(`git commit -m "${message}"`, { cwd: projectPath, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

module.exports = { gitInit, gitAdd, gitCommit };
