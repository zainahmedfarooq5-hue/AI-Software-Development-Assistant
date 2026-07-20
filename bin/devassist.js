#!/usr/bin/env node

const { execute, listProjects, banner, LOG } = require('../lib/index');
const readline = require('readline');

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  banner();
  console.log('Usage:');
  console.log('  devassist "Create a Flask login page"    Create a project from natural language');
  console.log('  devassist --list                         List all projects');
  console.log('  devassist --interactive                  Start interactive mode');
  console.log('');
  console.log('Examples:');
  console.log('  devassist "Create a Flask login page"');
  console.log('  devassist "Build a Node.js todo app"');
  console.log('  devassist "Make a static landing page"');
  console.log('  devassist "Create a Flask blog"');
  console.log('  devassist "Build a REST API with Python"');
  console.log('  devassist "Create a register page"');
  process.exit(0);
}

if (args.includes('--list') || args.includes('-l')) {
  listProjects();
  process.exit(0);
}

if (args.includes('--interactive') || args.includes('-i')) {
  banner();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\x1b[35mdevassist>\x1b[0m ',
  });

  LOG.info('Interactive mode. Type your request or "exit" to quit.\n');
  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input || input === 'exit' || input === 'quit') {
      LOG.ok('Goodbye!');
      process.exit(0);
    }
    if (input === 'list') {
      listProjects();
    } else {
      try {
        await execute(input);
      } catch (err) {
        LOG.err(`Error: ${err.message}`);
      }
    }
    console.log('');
    rl.prompt();
  });

  rl.on('close', () => process.exit(0));
} else if (args.length > 0 && !args[0].startsWith('-')) {
  // Direct execution mode
  execute(args.join(' ')).catch(err => {
    LOG.err(`Error: ${err.message}`);
    process.exit(1);
  });
} else {
  banner();
  LOG.info('Usage: devassist "your request here"');
  LOG.info('Run with --help for more options');
}
