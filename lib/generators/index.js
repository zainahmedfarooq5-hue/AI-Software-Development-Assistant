const { writeFile, ensureDir } = require('../tools/filesystem');
const { getTemplate } = require('./flask');
const path = require('path');

function generateFlaskProject(projectPath, parsed) {
  const pageType = parsed.pageType ? parsed.pageType.name : 'login';
  const projectName = parsed.projectName || 'flask-app';
  const template = getTemplate(pageType);

  ensureDir(projectPath);
  ensureDir(path.join(projectPath, 'templates'));
  ensureDir(path.join(projectPath, 'static'));

  // app.py
  if (template.app) {
    const content = template.app(projectName);
    if (content) writeFile(path.join(projectPath, 'app.py'), content);
  }

  // login.html - always generate for login/register page types
  if (template.loginHtml) {
    const content = template.loginHtml(projectName);
    if (content) writeFile(path.join(projectPath, 'templates', 'login.html'), content);
  }

  // register.html - generate for login page type (since backend supports it)
  if (pageType === 'login' && template.loginHtml) {
    const regTemplate = getTemplate('register');
    if (regTemplate.registerHtml) {
      writeFile(path.join(projectPath, 'templates', 'register.html'), regTemplate.registerHtml(projectName));
    }
  } else if (template.registerHtml) {
    const content = template.registerHtml(projectName);
    if (content) writeFile(path.join(projectPath, 'templates', 'register.html'), content);
  }

  // dashboard.html
  if (template.dashboardHtml) {
    const content = template.dashboardHtml(projectName);
    if (content) writeFile(path.join(projectPath, 'templates', 'dashboard.html'), content);
  }

  // admin.html
  if (template.adminHtml) {
    const content = template.adminHtml(projectName);
    if (content) writeFile(path.join(projectPath, 'templates', 'admin.html'), content);
  }

  // index.html (for blog/todo)
  if (template.indexHtml) {
    const content = template.indexHtml(projectName);
    if (content && content.trim()) writeFile(path.join(projectPath, 'templates', 'index.html'), content);
  }

  // post.html (for blog)
  if (template.postHtml) {
    const content = template.postHtml(projectName);
    if (content && content.trim()) writeFile(path.join(projectPath, 'templates', 'post.html'), content);
  }

  // new.html (for blog)
  if (template.newHtml) {
    const content = template.newHtml(projectName);
    if (content && content.trim()) writeFile(path.join(projectPath, 'templates', 'new.html'), content);
  }

  // style.css
  if (template.css) {
    const content = template.css();
    if (content) writeFile(path.join(projectPath, 'static', 'style.css'), content);
  }

  // script.js
  if (template.js) {
    const content = template.js();
    if (content) writeFile(path.join(projectPath, 'static', 'script.js'), content);
  }

  // requirements.txt
  if (template.requirements) {
    writeFile(path.join(projectPath, 'requirements.txt'), template.requirements());
  }

  // .gitignore
  if (template.gitignore) {
    writeFile(path.join(projectPath, '.gitignore'), template.gitignore());
  }

  const files = [];
  if (template.app) files.push('app.py');
  if (template.loginHtml) files.push('templates/login.html');
  if (template.registerHtml || pageType === 'login') files.push('templates/register.html');
  if (template.dashboardHtml) files.push('templates/dashboard.html');
  if (template.adminHtml) files.push('templates/admin.html');
  if (template.indexHtml) files.push('templates/index.html');
  if (template.css) files.push('static/style.css');
  if (template.js) files.push('static/script.js');
  files.push('requirements.txt', '.gitignore');

  return {
    files: files.filter(Boolean),
    serverCommand: 'python app.py',
    serverType: 'pip',
    port: 5000,
  };
}

function generateExpressProject(projectPath, parsed) {
  ensureDir(projectPath);
  ensureDir(path.join(projectPath, 'public'));
  ensureDir(path.join(projectPath, 'views'));

  const projectName = parsed.projectName || 'express-app';

  writeFile(path.join(projectPath, 'package.json'), JSON.stringify({
    name: projectName,
    version: '1.0.0',
    scripts: { start: 'node server.js' },
    dependencies: { express: '^4.18.0' },
  }, null, 2));

  writeFile(path.join(projectPath, 'server.js'), `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html');
});

app.listen(PORT, () => {
    console.log('Server running at http://localhost:' + PORT);
});
`);

  writeFile(path.join(projectPath, 'views', 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <h1>${projectName}</h1>
    <p>Welcome to your Express app!</p>
    <script src="/script.js"></script>
</body>
</html>
`);

  writeFile(path.join(projectPath, 'public', 'style.css'), `body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }\n`);
  writeFile(path.join(projectPath, 'public', 'script.js'), `console.log('${projectName} loaded');\n`);
  writeFile(path.join(projectPath, '.gitignore'), 'node_modules/\n.DS_Store\n');

  return {
    files: ['server.js', 'package.json', 'views/index.html', 'public/style.css', 'public/script.js', '.gitignore'],
    serverCommand: 'npm start',
    serverType: 'npm',
    port: 3000,
  };
}

function generateStaticProject(projectPath, parsed) {
  const pageType = parsed.pageType ? parsed.pageType.name : 'landing';
  const projectName = parsed.projectName || 'static-site';
  const template = getTemplate(pageType);

  ensureDir(projectPath);
  ensureDir(path.join(projectPath, 'css'));
  ensureDir(path.join(projectPath, 'js'));

  const htmlContent = pageType === 'landing' && template.landingHtml
    ? template.landingHtml(projectName)
    : template.loginHtml
      ? template.loginHtml(projectName).replace(/\{\{.*?\}\}/g, '').replace(/\{%.*?%\}/g, '')
      : `<h1>${projectName}</h1>`;

  writeFile(path.join(projectPath, 'index.html'), htmlContent);
  if (template.css) {
    const css = template.css();
    if (css) writeFile(path.join(projectPath, 'css', 'style.css'), css);
  }
  if (template.js) {
    const js = template.js();
    if (js) writeFile(path.join(projectPath, 'js', 'script.js'), js);
  }
  writeFile(path.join(projectPath, '.gitignore'), '.DS_Store\nnode_modules/\n');

  return {
    files: ['index.html', 'css/style.css', 'js/script.js', '.gitignore'],
    serverCommand: null,
    serverType: null,
    port: null,
  };
}

module.exports = { generateFlaskProject, generateExpressProject, generateStaticProject };
