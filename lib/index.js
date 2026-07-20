const path = require('path');
const os = require('os');
const { parse } = require('./parser');
const { generateFlaskProject, generateExpressProject, generateStaticProject } = require('./generators/index');
const { ensureDir, listFiles } = require('./tools/filesystem');
const { gitInit, gitAdd, gitCommit } = require('./tools/git');
const { installDependencies, startServer, openBrowser, runCommand } = require('./tools/terminal');

const LOG = {
  step: (msg) => console.log(`\x1b[36m▸\x1b[0m ${msg}`),
  ok: (msg) => console.log(`\x1b[32m✔\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m!\x1b[0m ${msg}`),
  err: (msg) => console.log(`\x1b[31m✖\x1b[0m ${msg}`),
  info: (msg) => console.log(`\x1b[37m  ${msg}\x1b[0m`),
  header: (msg) => console.log(`\n\x1b[1m\x1b[35m${msg}\x1b[0m`),
};

function banner() {
  console.log(`
\x1b[35m╔══════════════════════════════════════════════════════╗
║                                                      ║
║   🤖 AI Software Development Assistant               ║
║   ──────────────────────────────────────────          ║
║   Create full projects from natural language          ║
║                                                      ║
╚══════════════════════════════════════════════════════╝\x1b[0m
`);
}

async function execute(input) {
  banner();

  LOG.step('Analyzing your request...');
  LOG.info(`"${input}"`);

  // Parse the natural language input
  const parsed = parse(input);

  LOG.step('Detected: ' + [
    parsed.framework ? `Framework: ${parsed.framework.type}` : null,
    parsed.pageType ? `Page: ${parsed.pageType.description}` : null,
    parsed.projectName ? `Project: ${parsed.projectName}` : null,
  ].filter(Boolean).join(' | '));

  if (!parsed.framework) {
    LOG.warn('No framework detected. Defaulting to Flask (Python).');
    parsed.framework = { type: 'flask', language: 'python' };
  }

  if (!parsed.pageType) {
    LOG.warn('No specific page type detected. Creating a general login page.');
    parsed.pageType = { name: 'login', description: 'Login page' };
  }

  // Determine project path
  const baseDir = path.join(os.homedir(), 'source', 'projects');
  ensureDir(baseDir);
  const projectPath = path.join(baseDir, parsed.projectName);

  LOG.step('Creating project directory...');
  ensureDir(projectPath);
  LOG.ok(`Project directory: ${projectPath}`);

  // Generate project based on framework
  let result;
  LOG.step('Generating project files...');
  switch (parsed.framework.type) {
    case 'flask':
      result = generateFlaskProject(projectPath, parsed);
      break;
    case 'express':
      result = generateExpressProject(projectPath, parsed);
      break;
    case 'static':
      result = generateStaticProject(projectPath, parsed);
      break;
    default:
      result = generateFlaskProject(projectPath, parsed);
  }

  LOG.ok(`Generated ${result.files.length} files:`);
  result.files.forEach(f => LOG.info(`  ${f}`));

  // Initialize Git
  LOG.step('Initializing Git repository...');
  if (gitInit(projectPath)) {
    gitAdd(projectPath);
    gitCommit(projectPath, `Initial commit: ${parsed.projectName}`);
    LOG.ok('Git repository initialized with initial commit');
  } else {
    LOG.warn('Git init failed (git may not be installed)');
  }

  // Install dependencies
  if (result.serverType) {
    LOG.step(`Installing dependencies (${result.serverType})...`);
    const depResult = installDependencies(projectPath, result.serverType);
    if (depResult.success) {
      LOG.ok('Dependencies installed successfully');
    } else {
      LOG.warn('Dependency installation had issues - check output');
    }
  }

  // Start the server
  if (result.serverCommand) {
    LOG.step('Starting development server...');
    const child = startServer(projectPath, result.serverCommand);
    LOG.ok(`Server starting on http://localhost:${result.port}`);

    // Wait a moment then open browser
    setTimeout(() => {
      LOG.step('Opening in browser...');
      if (openBrowser(`http://localhost:${result.port}`)) {
        LOG.ok('Browser opened');
      } else {
        LOG.warn('Could not open browser automatically');
        LOG.info(`Navigate to: http://localhost:${result.port}`);
      }
    }, 2000);
  } else {
    LOG.step('Static project created (no server needed)');
    LOG.info(`Open ${path.join(projectPath, 'index.html')} in a browser`);
  }

  // Summary
  LOG.header('═══ Project Complete! ═══');
  LOG.ok(`Project: ${parsed.projectName}`);
  LOG.ok(`Location: ${projectPath}`);
  LOG.ok(`Type: ${parsed.framework.type} - ${parsed.pageType.description}`);
  if (result.port) {
    LOG.info(`Running at: http://localhost:${result.port}`);
  }

  return { projectPath, parsed, result };
}

function listProjects() {
  const baseDir = path.join(os.homedir(), 'source', 'projects');
  if (!require('fs').existsSync(baseDir)) {
    LOG.warn('No projects found');
    return [];
  }
  const projects = require('fs').readdirSync(baseDir).filter(f => {
    return require('fs').statSync(path.join(baseDir, f)).isDirectory();
  });
  LOG.header('═══ Your Projects ═══');
  projects.forEach(p => LOG.info(`  📁 ${p}`));
  return projects;
}

module.exports = { execute, listProjects, banner, LOG };
