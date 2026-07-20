const { execSync, spawn } = require('child_process');
const path = require('path');

function runCommand(command, cwd, options = {}) {
  try {
    const result = execSync(command, {
      cwd,
      stdio: options.silent ? 'pipe' : 'inherit',
      timeout: options.timeout || 60000,
      shell: true,
      env: { ...process.env, ...options.env },
    });
    return { success: true, output: result ? result.toString() : '' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function installDependencies(projectPath, type = 'pip') {
  if (type === 'pip') {
    const reqPath = path.join(projectPath, 'requirements.txt');
    if (require('fs').existsSync(reqPath)) {
      return runCommand('pip install -r requirements.txt', projectPath, { timeout: 120000 });
    }
  } else if (type === 'npm') {
    return runCommand('npm install', projectPath, { timeout: 120000 });
  }
  return { success: true, output: 'No dependencies to install' };
}

function startServer(projectPath, command) {
  const child = spawn(command.split(/\s+/)[0], command.split(/\s+/).slice(1), {
    cwd: projectPath,
    stdio: 'pipe',
    shell: true,
    detached: true,
  });
  child.unref();
  return child;
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === 'win32') cmd = `start "" "${url}"`;
  else if (platform === 'darwin') cmd = `open "${url}"`;
  else cmd = `xdg-open "${url}"`;
  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

module.exports = { runCommand, installDependencies, startServer, openBrowser };
