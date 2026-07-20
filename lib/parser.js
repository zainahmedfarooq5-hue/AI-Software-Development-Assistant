/**
 * Natural Language Parser
 * Keyword-based intent recognition for developer commands
 */

const FRAMEWORKS = {
  flask: {
    keywords: ['flask', 'python', 'python web'],
    type: 'flask',
    language: 'python',
    extensions: { server: '.py', template: '.html', style: '.css', script: '.js' },
  },
  express: {
    keywords: ['express', 'node', 'nodejs', 'node.js'],
    type: 'express',
    language: 'javascript',
    extensions: { server: '.js', template: '.ejs', style: '.css', script: '.js' },
  },
  static: {
    keywords: ['static', 'html', 'website', 'landing', 'page', 'frontend', 'front-end'],
    type: 'static',
    language: 'html',
    extensions: { server: null, template: '.html', style: '.css', script: '.js' },
  },
};

const PAGE_TYPES = {
  login: {
    keywords: ['login', 'log in', 'signin', 'sign in', 'auth', 'authenticate'],
    name: 'login',
    description: 'User authentication page',
  },
  register: {
    keywords: ['register', 'signup', 'sign up', 'create account', 'new account'],
    name: 'register',
    description: 'User registration page',
  },
  dashboard: {
    keywords: ['dashboard', 'admin', 'panel', 'control panel'],
    name: 'dashboard',
    description: 'Admin dashboard page',
  },
  todo: {
    keywords: ['todo', 'to-do', 'task', 'tasks', 'task manager'],
    name: 'todo',
    description: 'Task management app',
  },
  blog: {
    keywords: ['blog', 'posts', 'articles', 'blogging'],
    name: 'blog',
    description: 'Blog application',
  },
  api: {
    keywords: ['api', 'rest', 'restful', 'endpoint', 'endpoints', 'web service'],
    name: 'api',
    description: 'REST API service',
  },
  landing: {
    keywords: ['landing', 'landing page', 'homepage', 'home page', 'coming soon', 'promo'],
    name: 'landing',
    description: 'Landing page',
  },
  portfolio: {
    keywords: ['portfolio', 'personal site', 'personal website', 'resume site'],
    name: 'portfolio',
    description: 'Personal portfolio site',
  },
  calculator: {
    keywords: ['calculator', 'calc', 'converter'],
    name: 'calculator',
    description: 'Calculator/converter app',
  },
  chat: {
    keywords: ['chat', 'messaging', 'message app', 'chat app'],
    name: 'chat',
    description: 'Chat application',
  },
};

const FEATURES = {
  database: ['database', 'db', 'sqlite', 'mysql', 'postgres', 'mongodb'],
  auth: ['auth', 'login', 'password', 'authentication', 'session'],
  api: ['api', 'endpoint', 'rest'],
  frontend: ['frontend', 'front-end', 'html', 'css', 'javascript', 'react', 'vue'],
  testing: ['test', 'tests', 'testing', 'unit test', 'pytest', 'jest'],
};

function parse(input) {
  const lower = input.toLowerCase().trim();
  const result = {
    original: input,
    framework: null,
    pageType: null,
    features: [],
    projectName: null,
    raw: lower,
  };

  // Detect framework
  for (const [key, fw] of Object.entries(FRAMEWORKS)) {
    if (fw.keywords.some(k => lower.includes(k))) {
      result.framework = fw;
      break;
    }
  }

  // Default to Flask if no framework detected but Python mentioned
  if (!result.framework && lower.includes('python')) {
    result.framework = FRAMEWORKS.flask;
  }

  // Detect page type
  for (const [key, pt] of Object.entries(PAGE_TYPES)) {
    if (pt.keywords.some(k => lower.includes(k))) {
      result.pageType = pt;
      break;
    }
  }

  // Detect features
  for (const [feature, keywords] of Object.entries(FEATURES)) {
    if (keywords.some(k => lower.includes(k))) {
      result.features.push(feature);
    }
  }

  // Extract project name - look for quoted strings or specific patterns
  const quotedMatch = input.match(/["']([^"']+)["']/);
  if (quotedMatch) {
    result.projectName = quotedMatch[1].toLowerCase().replace(/[^a-z0-9-]/g, '-');
  } else {
    // Try to extract name from the request
    // "Create a Flask login page" -> "flask-login-app"
    // "Build a todo app" -> "todo-app"
    const nameWords = [];
    if (result.pageType) {
      nameWords.push(result.pageType.name);
    }
    if (result.framework) {
      nameWords.push(result.framework.type);
    }
    if (nameWords.length > 0) {
      result.projectName = nameWords.join('-') + '-app';
    } else {
      result.projectName = 'my-app';
    }
  }

  return result;
}

module.exports = { parse, FRAMEWORKS, PAGE_TYPES, FEATURES };
