# AI Software Development Assistant

Create full projects from natural language commands.

## Features
- **Natural Language Parser** - Type what you want, get a full project
- **Flask Projects** - Login, Register, Dashboard, Admin Panel, Blog, Todo, API
- **Express Projects** - Node.js server with HTML templates
- **Static Sites** - Landing pages, portfolios
- **Animated UI** - Glassmorphism, particles, smooth animations
- **Admin Panel** - User management, activity logs, suspend/promote/delete users
- **Desktop Account Storage** - User accounts saved to Desktop
- **Git Integration** - Auto-init, add, commit
- **Auto Install** - pip/npm dependency installation
- **Browser Launch** - Opens in browser automatically

## Quick Start

```bash
# Install
npm install

# Link globally (optional)
npm link

# Create a project
devassist "Create a Flask login page"
devassist "Build a Node.js todo app"
devassist "Make a static landing page"

# Interactive mode
devassist --interactive

# List projects
devassist --list
```

## Project Structure

```
ai-dev-assistant/
  bin/devassist.js          # CLI entry point
  lib/index.js              # Main orchestrator
  lib/parser.js             # Natural language parser
  lib/generators/flask.js   # Flask templates (HTML/CSS/JS)
  lib/generators/index.js   # Project generator
  lib/tools/filesystem.js   # File operations
  lib/tools/git.js          # Git operations
  lib/tools/terminal.js     # Terminal/browser operations
  example-project/          # Generated Flask app example
    app.py                  # Backend (Flask + Auth + Admin)
    templates/              # HTML templates
    static/                 # CSS + JS
  package.json
```

## Example Commands

```
"Create a Flask login page"
"Build a Flask register page"
"Make a Flask dashboard"
"Create a Flask blog"
"Build a Flask todo app"
"Create a REST API with Python"
"Make a static landing page"
"Build a Node.js express app"
```

## Admin Panel

- Go to `/login`, click **Admin** tab
- Username: `admin`
- Password: `admin123`

## Network Access

Server binds to `0.0.0.0` so others on your network can access:
```
http://YOUR_IP:5000
```

Allow firewall:
```bash
netsh advfirewall firewall add rule name="Flask App" dir=in action=allow protocol=TCP localport=5000
```

## License

MIT
