const path = require('path');
const { writeFile } = require('../tools/filesystem');

const TEMPLATES = {
  login: {
    app: (projectName) => `from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import os, json, hashlib, uuid
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.urandom(24)

DESKTOP = os.path.join(os.path.expanduser("~"), "Desktop")
ACCOUNTS_FILE = os.path.join(DESKTOP, "user_accounts.json")
ADMIN_PASSWORD = "admin123"

def load_accounts():
    if os.path.exists(ACCOUNTS_FILE):
        with open(ACCOUNTS_FILE, "r") as f:
            return json.load(f)
    return {"users": [], "sessions": []}

def save_accounts(data):
    with open(ACCOUNTS_FILE, "w") as f:
        json.dump(data, f, indent=2)

def hash_password(password):
    salt = uuid.uuid4().hex
    hashed = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}:{hashed}"

def verify_password(stored, provided):
    salt, hashed = stored.split(":")
    return hashlib.sha256((provided + salt).encode()).hexdigest() == hashed

@app.route("/")
def index():
    if "admin" in session:
        return redirect(url_for("admin_dashboard"))
    if "user" in session:
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))

# ==================== AUTH ROUTES ====================

@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()
        login_type = request.form.get("login_type", "user")

        if login_type == "admin":
            if username == "admin" and password == ADMIN_PASSWORD:
                session["admin"] = True
                session["admin_login_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                accounts = load_accounts()
                accounts["sessions"].append({
                    "user": "admin",
                    "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "action": "admin_login"
                })
                save_accounts(accounts)
                return redirect(url_for("admin_dashboard"))
            error = "Invalid admin credentials"
        else:
            accounts = load_accounts()
            user = next((u for u in accounts["users"] if u["username"] == username), None)
            if user and verify_password(user["password"], password):
                session["user"] = username
                session["user_id"] = user["id"]
                session["avatar"] = user.get("avatar", username[0].upper())
                user["last_login"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                user["login_count"] = user.get("login_count", 0) + 1
                accounts["sessions"].append({
                    "user": username,
                    "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "action": "login"
                })
                save_accounts(accounts)
                return redirect(url_for("dashboard"))
            error = "Invalid username or password"
    return render_template("login.html", error=error)

@app.route("/register", methods=["GET", "POST"])
def register():
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "").strip()
        confirm = request.form.get("confirm_password", "").strip()
        if not username or not email or not password:
            error = "All fields are required"
        elif len(username) < 3:
            error = "Username must be at least 3 characters"
        elif len(password) < 6:
            error = "Password must be at least 6 characters"
        elif password != confirm:
            error = "Passwords do not match"
        else:
            accounts = load_accounts()
            if any(u["username"] == username for u in accounts["users"]):
                error = "Username already exists"
            elif any(u["email"] == email for u in accounts["users"]):
                error = "Email already registered"
            else:
                user_id = str(uuid.uuid4())[:8]
                new_user = {
                    "id": user_id,
                    "username": username,
                    "email": email,
                    "password": hash_password(password),
                    "avatar": username[0].upper(),
                    "role": "user",
                    "created": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "last_login": None,
                    "login_count": 0,
                    "status": "active"
                }
                accounts["users"].append(new_user)
                accounts["sessions"].append({
                    "user": username,
                    "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "action": "register"
                })
                save_accounts(accounts)
                return redirect(url_for("login"))
    return render_template("register.html", error=error)

@app.route("/logout")
def logout():
    if "admin" in session:
        accounts = load_accounts()
        accounts["sessions"].append({
            "user": "admin",
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "action": "admin_logout"
        })
        save_accounts(accounts)
    elif "user" in session:
        accounts = load_accounts()
        accounts["sessions"].append({
            "user": session["user"],
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "action": "logout"
        })
        save_accounts(accounts)
    session.clear()
    return redirect(url_for("login"))

# ==================== USER DASHBOARD ====================

@app.route("/dashboard")
def dashboard():
    if "admin" in session:
        return redirect(url_for("admin_dashboard"))
    if "user" not in session:
        return redirect(url_for("login"))
    accounts = load_accounts()
    user = next((u for u in accounts["users"] if u["username"] == session["user"]), None)
    recent_sessions = [s for s in accounts["sessions"] if s["user"] == session["user"]][-5:][::-1]
    return render_template("dashboard.html",
        user=user,
        sessions=recent_sessions,
        total_users=len(accounts["users"]),
        total_sessions=len(accounts["sessions"])
    )

# ==================== ADMIN PANEL ====================

@app.route("/admin")
def admin_redirect():
    if "admin" not in session:
        return redirect(url_for("login"))
    return redirect(url_for("admin_dashboard"))

@app.route("/admin/dashboard")
def admin_dashboard():
    if "admin" not in session:
        return redirect(url_for("login"))
    accounts = load_accounts()
    total_users = len(accounts["users"])
    active_users = len([u for u in accounts["users"] if u.get("status") == "active"])
    total_sessions = len(accounts["sessions"])
    recent_sessions = accounts["sessions"][-10:][::-1]

    logins_today = len([s for s in accounts["sessions"]
        if s["action"] == "login" and s["time"][:10] == datetime.now().strftime("%Y-%m-%d")])
    registrations_today = len([s for s in accounts["sessions"]
        if s["action"] == "register" and s["time"][:10] == datetime.now().strftime("%Y-%m-%d")])

    return render_template("admin.html",
        users=accounts["users"],
        sessions=recent_sessions,
        total_users=total_users,
        active_users=active_users,
        total_sessions=total_sessions,
        logins_today=logins_today,
        registrations_today=registrations_today,
        now=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )

@app.route("/admin/delete_user/<user_id>", methods=["POST"])
def admin_delete_user(user_id):
    if "admin" not in session:
        return redirect(url_for("login"))
    accounts = load_accounts()
    accounts["users"] = [u for u in accounts["users"] if u["id"] != user_id]
    accounts["sessions"].append({
        "user": "admin",
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "action": f"deleted_user_{user_id}"
    })
    save_accounts(accounts)
    return redirect(url_for("admin_dashboard"))

@app.route("/admin/toggle_user/<user_id>", methods=["POST"])
def admin_toggle_user(user_id):
    if "admin" not in session:
        return redirect(url_for("login"))
    accounts = load_accounts()
    for u in accounts["users"]:
        if u["id"] == user_id:
            u["status"] = "suspended" if u.get("status") == "active" else "active"
            break
    accounts["sessions"].append({
        "user": "admin",
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "action": f"toggled_user_{user_id}"
    })
    save_accounts(accounts)
    return redirect(url_for("admin_dashboard"))

@app.route("/admin/promote_user/<user_id>", methods=["POST"])
def admin_promote_user(user_id):
    if "admin" not in session:
        return redirect(url_for("login"))
    accounts = load_accounts()
    for u in accounts["users"]:
        if u["id"] == user_id:
            u["role"] = "admin" if u.get("role") != "admin" else "user"
            break
    save_accounts(accounts)
    return redirect(url_for("admin_dashboard"))

# ==================== API ====================

@app.route("/api/accounts")
def api_accounts():
    accounts = load_accounts()
    safe_users = [{
        "username": u["username"], "email": u["email"],
        "created": u["created"], "avatar": u.get("avatar", u["username"][0].upper()),
        "status": u.get("status", "active"), "role": u.get("role", "user")
    } for u in accounts["users"]]
    return jsonify({"users": safe_users, "total": len(safe_users)})

if __name__ == "__main__":
    if not os.path.exists(ACCOUNTS_FILE):
        save_accounts({"users": [], "sessions": []})
    print("\\n" + "="*55)
    print(f"  Account data: {ACCOUNTS_FILE}")
    print(f"  Admin login:  admin / {ADMIN_PASSWORD}")
    print("="*55 + "\\n")
    app.run(debug=True, host="0.0.0.0", port=5000)
`,

    loginHtml: (projectName) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName} - Sign In</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='style.css') }}">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body>
    <canvas id="particles"></canvas>
    <div class="floating-shapes">
        <div class="shape shape-1"></div><div class="shape shape-2"></div>
        <div class="shape shape-3"></div><div class="shape shape-4"></div>
        <div class="shape shape-5"></div>
    </div>

    <div class="auth-wrapper">
        <div class="auth-card" id="authCard">
            <div class="card-glow"></div>
            <div class="auth-header">
                <div class="logo-animated">
                    <div class="logo-ring"></div>
                    <div class="logo-ring ring-2"></div>
                    <span class="logo-icon">&#9883;</span>
                </div>
                <h1 class="title typing-effect">Welcome Back</h1>
                <p class="subtitle fade-in-up">Sign in to your account</p>
            </div>

            {% if error %}
            <div class="alert alert-error shake">
                <span class="alert-icon">&#9888;</span> {{ error }}
            </div>
            {% endif %}

            <div class="login-tabs">
                <button class="login-tab active" onclick="switchTab('user')" id="tabUser">
                    <span>&#128100;</span> User
                </button>
                <button class="login-tab" onclick="switchTab('admin')" id="tabAdmin">
                    <span>&#128737;</span> Admin
                </button>
            </div>

            <form method="POST" action="{{ url_for('login') }}" class="auth-form" id="loginForm">
                <input type="hidden" name="login_type" id="loginType" value="user">

                <div class="input-group floating">
                    <input type="text" id="username" name="username" placeholder=" " required autofocus>
                    <label for="username">Username</label>
                    <div class="input-border"></div>
                    <span class="input-icon">&#128100;</span>
                </div>

                <div class="input-group floating">
                    <input type="password" id="password" name="password" placeholder=" " required>
                    <label for="password">Password</label>
                    <div class="input-border"></div>
                    <span class="input-icon">&#128272;</span>
                    <button type="button" class="toggle-password" onclick="togglePassword()">
                        <span class="eye-open">&#128065;</span>
                        <span class="eye-closed" style="display:none;">&#128064;</span>
                    </button>
                </div>

                <div class="form-options">
                    <label class="checkbox-custom">
                        <input type="checkbox" name="remember">
                        <span class="checkmark"></span> Remember me
                    </label>
                    <a href="#" class="forgot-link">Forgot password?</a>
                </div>

                <button type="submit" class="btn btn-primary btn-glow" id="submitBtn">
                    <span class="btn-text">Sign In</span>
                    <span class="btn-loader" style="display:none;"><span class="spinner"></span></span>
                    <span class="btn-arrow">&rarr;</span>
                </button>
            </form>

            <div class="auth-footer">
                <p>New here? <a href="/register" class="link-glow">Create an account</a></p>
            </div>
        </div>
    </div>
    <div class="toast-container" id="toastContainer"></div>
    <script>
    function switchTab(type) {
        document.getElementById('loginType').value = type;
        document.getElementById('tabUser').classList.toggle('active', type === 'user');
        document.getElementById('tabAdmin').classList.toggle('active', type === 'admin');
        const card = document.getElementById('authCard');
        card.classList.toggle('admin-mode', type === 'admin');
    }
    </script>
    <script src="{{ url_for('static', filename='script.js') }}"></script>
</body>
</html>
`,

    registerHtml: (projectName) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName} - Create Account</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='style.css') }}">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body>
    <canvas id="particles"></canvas>
    <div class="floating-shapes">
        <div class="shape shape-1"></div><div class="shape shape-2"></div>
        <div class="shape shape-3"></div><div class="shape shape-4"></div>
        <div class="shape shape-5"></div>
    </div>

    <div class="auth-wrapper">
        <div class="auth-card register-card" id="authCard">
            <div class="card-glow"></div>
            <div class="auth-header">
                <div class="logo-animated">
                    <div class="logo-ring"></div>
                    <div class="logo-ring ring-2"></div>
                    <span class="logo-icon">&#10024;</span>
                </div>
                <h1 class="title typing-effect">Create Account</h1>
                <p class="subtitle fade-in-up">Join us and start building amazing things</p>
            </div>

            {% if error %}
            <div class="alert alert-error shake">
                <span class="alert-icon">&#9888;</span> {{ error }}
            </div>
            {% endif %}

            <form method="POST" action="{{ url_for('register') }}" class="auth-form" id="registerForm">
                <div class="input-group floating">
                    <input type="text" id="username" name="username" placeholder=" " required minlength="3">
                    <label for="username">Username</label>
                    <div class="input-border"></div>
                    <span class="input-icon">&#128100;</span>
                </div>

                <div class="input-group floating">
                    <input type="email" id="email" name="email" placeholder=" " required>
                    <label for="email">Email</label>
                    <div class="input-border"></div>
                    <span class="input-icon">&#9993;</span>
                </div>

                <div class="input-group floating">
                    <input type="password" id="password" name="password" placeholder=" " required minlength="6">
                    <label for="password">Password (min 6 chars)</label>
                    <div class="input-border"></div>
                    <span class="input-icon">&#128272;</span>
                    <button type="button" class="toggle-password" onclick="togglePassword()">
                        <span class="eye-open">&#128065;</span>
                        <span class="eye-closed" style="display:none;">&#128064;</span>
                    </button>
                    <div class="password-strength" id="strengthBar"><div class="strength-fill"></div></div>
                </div>

                <div class="input-group floating">
                    <input type="password" id="confirm_password" name="confirm_password" placeholder=" " required>
                    <label for="confirm_password">Confirm Password</label>
                    <div class="input-border"></div>
                    <span class="input-icon">&#128273;</span>
                    <div class="match-indicator" id="matchIndicator"></div>
                </div>

                <div class="form-options">
                    <label class="checkbox-custom">
                        <input type="checkbox" name="terms" required>
                        <span class="checkmark"></span>
                        I agree to the <a href="#" class="link-glow">Terms</a>
                    </label>
                </div>

                <button type="submit" class="btn btn-primary btn-glow" id="submitBtn">
                    <span class="btn-text">Create Account</span>
                    <span class="btn-loader" style="display:none;"><span class="spinner"></span></span>
                    <span class="btn-arrow">&rarr;</span>
                </button>
            </form>

            <div class="auth-footer">
                <p>Already have an account? <a href="/login" class="link-glow">Sign in</a></p>
            </div>
        </div>
    </div>
    <div class="toast-container" id="toastContainer"></div>
    <script src="{{ url_for('static', filename='script.js') }}"></script>
</body>
</html>
`,

    dashboardHtml: (projectName) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName} - Dashboard</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='style.css') }}">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body class="dashboard-body">
    <canvas id="particles"></canvas>
    <div class="dashboard-container">
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="brand"><span class="brand-icon">&#9883;</span><span class="brand-text">Nexus</span></div>
                <button class="sidebar-toggle" onclick="toggleSidebar()">&#9776;</button>
            </div>
            <nav class="sidebar-nav">
                <a href="/dashboard" class="nav-item active"><span class="nav-icon">&#127968;</span><span class="nav-label">Dashboard</span></a>
                <a href="#" class="nav-item"><span class="nav-icon">&#128200;</span><span class="nav-label">Analytics</span></a>
                <a href="#" class="nav-item"><span class="nav-icon">&#128196;</span><span class="nav-label">Projects</span></a>
                <a href="/admin/dashboard" class="nav-item" title="Admin Panel"><span class="nav-icon">&#128737;</span><span class="nav-label">Admin Panel</span></a>
                <a href="/logout" class="nav-item logout-item"><span class="nav-icon">&#128682;</span><span class="nav-label">Logout</span></a>
            </nav>
            <div class="sidebar-footer">
                <div class="user-card">
                    <div class="user-avatar animate-pulse">{{ user.avatar if user else "U" }}</div>
                    <div class="user-info">
                        <span class="user-name">{{ user.username if user else "User" }}</span>
                        <span class="user-role">{{ user.role if user and user.role else "User" }}</span>
                    </div>
                </div>
            </div>
        </aside>

        <main class="main-content">
            <header class="topbar">
                <div class="topbar-left">
                    <button class="mobile-toggle" onclick="toggleSidebar()">&#9776;</button>
                    <h1 class="page-title slide-in">Welcome back, <span class="gradient-text">{{ user.username if user else "User" }}</span></h1>
                </div>
                <div class="topbar-right">
                    <div class="search-box"><input type="text" placeholder="Search..." class="search-input"><span class="search-icon">&#128269;</span></div>
                    <button class="icon-btn"><span>&#128276;</span><span class="notification-badge">3</span></button>
                    <div class="topbar-avatar">{{ user.avatar if user else "U" }}</div>
                </div>
            </header>

            <div class="content-grid">
                <div class="stats-row">
                    <div class="stat-card glass-card" style="--delay:0">
                        <div class="stat-icon-wrap blue"><span>&#128101;</span></div>
                        <div class="stat-info"><h3 class="stat-label">Total Users</h3><p class="stat-value" data-count="{{ total_users }}">0</p></div>
                        <div class="stat-trend up">&#8593; 12%</div>
                    </div>
                    <div class="stat-card glass-card" style="--delay:1">
                        <div class="stat-icon-wrap green"><span>&#128200;</span></div>
                        <div class="stat-info"><h3 class="stat-label">Sessions</h3><p class="stat-value" data-count="{{ total_sessions }}">0</p></div>
                        <div class="stat-trend up">&#8593; 8%</div>
                    </div>
                    <div class="stat-card glass-card" style="--delay:2">
                        <div class="stat-icon-wrap orange"><span>&#128640;</span></div>
                        <div class="stat-info"><h3 class="stat-label">Projects</h3><p class="stat-value" data-count="12">0</p></div>
                        <div class="stat-trend up">&#8593; 24%</div>
                    </div>
                    <div class="stat-card glass-card" style="--delay:3">
                        <div class="stat-icon-wrap purple"><span>&#128176;</span></div>
                        <div class="stat-info"><h3 class="stat-label">Revenue</h3><p class="stat-value" data-count="8450" data-prefix="$">$0</p></div>
                        <div class="stat-trend up">&#8593; 18%</div>
                    </div>
                </div>

                <div class="middle-row">
                    <div class="chart-card glass-card" style="--delay:4">
                        <div class="card-header"><h2>Activity Overview</h2>
                            <div class="chart-tabs"><button class="chart-tab active">Week</button><button class="chart-tab">Month</button></div>
                        </div>
                        <div class="chart-area"><canvas id="activityChart"></canvas></div>
                    </div>
                    <div class="profile-card glass-card" style="--delay:5">
                        <div class="profile-header">
                            <div class="profile-avatar-large">{{ user.avatar if user else "U" }}</div>
                            <h2 class="profile-name">{{ user.username if user else "User" }}</h2>
                            <span class="profile-badge">&#127775; {{ user.role if user and user.role else "User" }}</span>
                        </div>
                        <div class="profile-stats">
                            <div class="profile-stat"><span class="ps-value">24</span><span class="ps-label">Projects</span></div>
                            <div class="profile-stat"><span class="ps-value">128</span><span class="ps-label">Commits</span></div>
                            <div class="profile-stat"><span class="ps-value">4.9</span><span class="ps-label">Rating</span></div>
                        </div>
                        <div class="profile-info">
                            <p><span>&#128231;</span> {{ user.email if user else "" }}</p>
                            <p><span>&#128197;</span> Joined {{ user.created[:10] if user and user.created else "Today" }}</p>
                        </div>
                    </div>
                </div>

                <div class="bottom-row">
                    <div class="activity-card glass-card" style="--delay:6">
                        <div class="card-header"><h2>Recent Activity</h2></div>
                        <div class="activity-feed">
                            {% for s in sessions %}
                            <div class="activity-item slide-in-right" style="--i:{{ loop.index }}">
                                <div class="activity-dot {{ 'green' if 'login' in s.action else ('red' if 'logout' in s.action else 'blue') }}"></div>
                                <div class="activity-content">
                                    <p class="activity-text">{{ s.action|replace('_',' ')|title }} by <strong>{{ s.user }}</strong></p>
                                    <span class="activity-time">{{ s.time }}</span>
                                </div>
                            </div>
                            {% endfor %}
                            {% if not sessions %}
                            <div class="activity-item"><div class="activity-dot blue"></div><div class="activity-content"><p class="activity-text">Welcome! Start exploring.</p></div></div>
                            {% endif %}
                        </div>
                    </div>
                    <div class="tasks-card glass-card" style="--delay:7">
                        <div class="card-header"><h2>Quick Actions</h2></div>
                        <div class="quick-actions">
                            <a href="/admin/dashboard" class="action-btn"><span class="action-icon">&#128737;</span><span>Admin Panel</span></a>
                            <a href="#" class="action-btn"><span class="action-icon">&#128640;</span><span>New Project</span></a>
                            <a href="#" class="action-btn"><span class="action-icon">&#128196;</span><span>New File</span></a>
                            <a href="/logout" class="action-btn"><span class="action-icon">&#128682;</span><span>Logout</span></a>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
    <script src="{{ url_for('static', filename='script.js') }}"></script>
</body>
</html>
`,

    adminHtml: (projectName) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName} - Admin Panel</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='style.css') }}">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body class="dashboard-body">
    <canvas id="particles"></canvas>
    <div class="dashboard-container">
        <aside class="sidebar admin-sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="brand"><span class="brand-icon">&#128737;</span><span class="brand-text admin-brand">Admin Panel</span></div>
                <button class="sidebar-toggle" onclick="toggleSidebar()">&#9776;</button>
            </div>
            <nav class="sidebar-nav">
                <a href="/admin/dashboard" class="nav-item active"><span class="nav-icon">&#127968;</span><span class="nav-label">Overview</span></a>
                <a href="#users-section" class="nav-item"><span class="nav-icon">&#128101;</span><span class="nav-label">Users</span></a>
                <a href="#activity-section" class="nav-item"><span class="nav-icon">&#128203;</span><span class="nav-label">Activity Log</span></a>
                <a href="/dashboard" class="nav-item"><span class="nav-icon">&#128100;</span><span class="nav-label">User View</span></a>
                <a href="/logout" class="nav-item logout-item"><span class="nav-icon">&#128682;</span><span class="nav-label">Logout</span></a>
            </nav>
            <div class="sidebar-footer">
                <div class="user-card">
                    <div class="user-avatar admin-avatar">&#128737;</div>
                    <div class="user-info">
                        <span class="user-name">Administrator</span>
                        <span class="user-role admin-role">Super Admin</span>
                    </div>
                </div>
            </div>
        </aside>

        <main class="main-content">
            <header class="topbar">
                <div class="topbar-left">
                    <button class="mobile-toggle" onclick="toggleSidebar()">&#9776;</button>
                    <h1 class="page-title slide-in">&#128737; Admin <span class="gradient-text-admin">Dashboard</span></h1>
                </div>
                <div class="topbar-right">
                    <span class="admin-badge">&#128274; Administrator</span>
                    <button class="icon-btn"><span>&#128276;</span><span class="notification-badge">5</span></button>
                </div>
            </header>

            <div class="content-grid">
                <div class="stats-row">
                    <div class="stat-card glass-card admin-stat" style="--delay:0">
                        <div class="stat-icon-wrap red-glow"><span>&#128101;</span></div>
                        <div class="stat-info"><h3 class="stat-label">Total Users</h3><p class="stat-value" data-count="{{ total_users }}">0</p></div>
                    </div>
                    <div class="stat-card glass-card admin-stat" style="--delay:1">
                        <div class="stat-icon-wrap green-glow"><span>&#9989;</span></div>
                        <div class="stat-info"><h3 class="stat-label">Active Users</h3><p class="stat-value" data-count="{{ active_users }}">0</p></div>
                    </div>
                    <div class="stat-card glass-card admin-stat" style="--delay:2">
                        <div class="stat-icon-wrap blue-glow"><span>&#128200;</span></div>
                        <div class="stat-info"><h3 class="stat-label">Total Sessions</h3><p class="stat-value" data-count="{{ total_sessions }}">0</p></div>
                    </div>
                    <div class="stat-card glass-card admin-stat" style="--delay:3">
                        <div class="stat-icon-wrap orange-glow"><span>&#128221;</span></div>
                        <div class="stat-info"><h3 class="stat-label">Registrations Today</h3><p class="stat-value" data-count="{{ registrations_today }}">0</p></div>
                    </div>
                </div>

                <div class="admin-section glass-card" id="users-section">
                    <div class="card-header">
                        <h2>&#128101; User Management</h2>
                        <span class="admin-counter">{{ total_users }} total</span>
                    </div>
                    <div class="user-table-wrap">
                        <table class="user-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Logins</th>
                                    <th>Joined</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {% for u in users %}
                                <tr class="user-row {% if u.status == 'suspended' %}row-suspended{% endif %}" style="--ri:{{ loop.index }}">
                                    <td>
                                        <div class="table-user">
                                            <div class="table-avatar {% if u.role == 'admin' %}admin-ring{% endif %}">{{ u.avatar if u.avatar else u.username[0]|upper }}</div>
                                            <span class="table-username">{{ u.username }}</span>
                                        </div>
                                    </td>
                                    <td class="td-email">{{ u.email }}</td>
                                    <td><span class="role-badge {% if u.role == 'admin' %}role-admin{% else %}role-user{% endif %}">{{ u.role if u.role else "user" }}</span></td>
                                    <td><span class="status-dot {{ 'active' if u.status == 'active' else 'suspended' }}"></span>{{ u.status if u.status else "active" }}</td>
                                    <td class="td-center">{{ u.login_count if u.login_count else 0 }}</td>
                                    <td class="td-muted">{{ u.created[:10] if u.created else "N/A" }}</td>
                                    <td class="td-actions">
                                        <form method="POST" action="/admin/toggle_user/{{ u.id }}" style="display:inline">
                                            <button type="submit" class="action-btn-sm {{ 'btn-suspend' if u.status == 'active' else 'btn-activate' }}" title="{{ 'Suspend' if u.status == 'active' else 'Activate' }}">
                                                {{ '&#9888;' if u.status == 'active' else '&#9989;' }}
                                            </button>
                                        </form>
                                        <form method="POST" action="/admin/promote_user/{{ u.id }}" style="display:inline">
                                            <button type="submit" class="action-btn-sm btn-promote" title="Toggle Admin">
                                                &#128081;
                                            </button>
                                        </form>
                                        <form method="POST" action="/admin/delete_user/{{ u.id }}" style="display:inline" onsubmit="return confirm('Delete this user?')">
                                            <button type="submit" class="action-btn-sm btn-delete" title="Delete">&#128465;</button>
                                        </form>
                                    </td>
                                </tr>
                                {% endfor %}
                                {% if not users %}
                                <tr><td colspan="7" class="td-empty">No users registered yet</td></tr>
                                {% endif %}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="bottom-row">
                    <div class="activity-card glass-card" id="activity-section" style="--delay:6">
                        <div class="card-header"><h2>&#128203; Activity Log</h2></div>
                        <div class="activity-feed">
                            {% for s in sessions %}
                            <div class="activity-item slide-in-right" style="--i:{{ loop.index }}">
                                <div class="activity-dot {{ 'green' if 'login' in s.action and 'admin' not in s.action else ('red' if 'logout' in s.action else ('purple' if 'admin' in s.action else 'blue')) }}"></div>
                                <div class="activity-content">
                                    <p class="activity-text">
                                        {% if s.action == 'admin_login' %}&#128737; Admin logged in
                                        {% elif s.action == 'admin_logout' %}&#128737; Admin logged out
                                        {% elif s.action == 'register' %}&#128221; New registration: <strong>{{ s.user }}</strong>
                                        {% elif s.action == 'login' %}&#128100; <strong>{{ s.user }}</strong> logged in
                                        {% elif s.action == 'logout' %}&#128682; <strong>{{ s.user }}</strong> logged out
                                        {% elif 'deleted_user' in s.action %}&#128465; Admin deleted a user
                                        {% elif 'toggled_user' in s.action %}&#9888; Admin toggled user status
                                        {% else %}{{ s.action|replace('_',' ')|title }}{% endif %}
                                    </p>
                                    <span class="activity-time">{{ s.time }}</span>
                                </div>
                            </div>
                            {% endfor %}
                            {% if not sessions %}
                            <div class="activity-item"><div class="activity-dot blue"></div><div class="activity-content"><p class="activity-text">No activity yet</p></div></div>
                            {% endif %}
                        </div>
                    </div>

                    <div class="glass-card admin-info-card" style="--delay:7">
                        <div class="card-header"><h2>&#128274; Admin Info</h2></div>
                        <div class="admin-info-body">
                            <div class="admin-info-item"><span class="admin-info-label">Session Started</span><span class="admin-info-value">{{ now }}</span></div>
                            <div class="admin-info-item"><span class="admin-info-label">Logins Today</span><span class="admin-info-value">{{ logins_today }}</span></div>
                            <div class="admin-info-item"><span class="admin-info-label">Accounts File</span><span class="admin-info-value td-email">Desktop/user_accounts.json</span></div>
                            <div class="admin-info-item"><span class="admin-info-label">Admin Password</span><span class="admin-info-value">admin123</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
    <script src="{{ url_for('static', filename='script.js') }}"></script>
</body>
</html>
`,

    css: () => `/* ============================================
   NEXUS UI - Animated Theme (with Admin)
   ============================================ */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

:root {
    --bg-primary: #060613; --bg-secondary: #0d0d2b;
    --bg-card: rgba(15,15,45,0.6); --bg-card-hover: rgba(20,20,55,0.8);
    --border: rgba(100,100,255,0.1); --border-hover: rgba(100,100,255,0.25);
    --text-primary: #f0f0ff; --text-secondary: #8888bb; --text-muted: #555588;
    --accent: #6366f1; --accent-glow: rgba(99,102,241,0.4);
    --green: #22c55e; --orange: #f59e0b; --red: #ef4444;
    --purple: #a855f7; --blue: #3b82f6; --pink: #ec4899;
    --radius: 16px; --radius-sm: 10px; --radius-xs: 6px;
    --shadow: 0 8px 32px rgba(0,0,0,0.4);
    --shadow-glow: 0 0 30px var(--accent-glow);
    --transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
    --font: 'Inter', system-ui, -apple-system, sans-serif;
}

html { scroll-behavior: smooth; }
body { font-family: var(--font); background: var(--bg-primary); color: var(--text-primary); min-height: 100vh; overflow-x: hidden; }

#particles { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }

/* --- Floating Shapes --- */
.floating-shapes { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; overflow: hidden; }
.shape { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.15; animation: floatShape 20s infinite ease-in-out; }
.shape-1 { width: 600px; height: 600px; background: var(--accent); top: -200px; left: -100px; }
.shape-2 { width: 500px; height: 500px; background: var(--purple); bottom: -200px; right: -100px; animation-delay: -5s; }
.shape-3 { width: 400px; height: 400px; background: var(--pink); top: 50%; left: 50%; animation-delay: -10s; }
.shape-4 { width: 350px; height: 350px; background: var(--blue); top: 20%; right: 10%; animation-delay: -7s; }
.shape-5 { width: 300px; height: 300px; background: var(--green); bottom: 10%; left: 20%; animation-delay: -12s; }
@keyframes floatShape { 0%,100%{transform:translate(0,0) rotate(0deg) scale(1)} 25%{transform:translate(40px,-30px) rotate(90deg) scale(1.1)} 50%{transform:translate(-20px,40px) rotate(180deg) scale(0.95)} 75%{transform:translate(30px,20px) rotate(270deg) scale(1.05)} }

/* --- Auth Wrapper --- */
.auth-wrapper { position: relative; z-index: 10; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }

/* --- Auth Card --- */
.auth-card { position: relative; background: rgba(12,12,40,0.7); backdrop-filter: blur(24px); border: 1px solid var(--border); border-radius: 24px; padding: 48px 40px; width: 100%; max-width: 440px; box-shadow: var(--shadow); animation: cardAppear 0.8s cubic-bezier(0.16,1,0.3,1) forwards; opacity: 0; transform: translateY(40px) scale(0.95); overflow: hidden; }
.auth-card.register-card { max-width: 480px; }
.auth-card.admin-mode { border-color: rgba(239,68,68,0.3); box-shadow: 0 0 40px rgba(239,68,68,0.15); }
.auth-card.admin-mode .card-glow { background: radial-gradient(circle at 30% 30%, rgba(239,68,68,0.2), transparent 60%); opacity: 0.2; }
.card-glow { position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at 30% 30%, var(--accent-glow), transparent 60%); opacity: 0; animation: glowPulse 4s ease-in-out infinite; pointer-events: none; }
.auth-card:hover .card-glow { opacity: 0.15; }
@keyframes cardAppear { to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes glowPulse { 0%,100%{opacity:0;transform:translate(0,0)} 50%{opacity:0.15;transform:translate(5%,5%)} }

/* --- Auth Header --- */
.auth-header { text-align: center; margin-bottom: 36px; }
.logo-animated { position: relative; width: 80px; height: 80px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; }
.logo-ring { position: absolute; width: 100%; height: 100%; border: 2px solid transparent; border-top-color: var(--accent); border-radius: 50%; animation: spin 3s linear infinite; }
.ring-2 { width: 70%; height: 70%; border-top-color: var(--purple); animation-direction: reverse; animation-duration: 2s; }
.logo-icon { font-size: 32px; animation: bounce 2s ease-in-out infinite; z-index: 2; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
.title { font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #fff, var(--accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.subtitle { color: var(--text-secondary); margin-top: 8px; font-size: 14px; }
.typing-effect { overflow: hidden; white-space: nowrap; border-right: 2px solid var(--accent); width: 0; animation: typing 1s steps(15) 0.5s forwards, blink 0.8s step-end infinite; }
@keyframes typing { to { width: 100%; } }
@keyframes blink { 50% { border-color: transparent; } }
.fade-in-up { opacity: 0; transform: translateY(10px); animation: fadeInUp 0.6s 1.2s forwards; }
@keyframes fadeInUp { to { opacity: 1; transform: translateY(0); } }

/* --- Login Tabs --- */
.login-tabs { display: flex; gap: 8px; margin-bottom: 24px; background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); padding: 4px; border: 1px solid var(--border); }
.login-tab { flex: 1; padding: 12px; border: none; border-radius: var(--radius-xs); background: transparent; color: var(--text-muted); font-size: 14px; font-weight: 600; cursor: pointer; transition: var(--transition); font-family: var(--font); display: flex; align-items: center; justify-content: center; gap: 6px; }
.login-tab.active { background: var(--accent); color: #fff; box-shadow: 0 4px 15px var(--accent-glow); }
.login-tab:hover:not(.active) { color: var(--text-primary); background: rgba(255,255,255,0.05); }

/* --- Alerts --- */
.alert { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-radius: var(--radius-sm); margin-bottom: 24px; font-size: 14px; animation: slideDown 0.4s ease-out; }
.alert-error { background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
.alert-icon { font-size: 18px; }
@keyframes slideDown { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
.shake { animation: shake 0.5s cubic-bezier(0.36,0.07,0.19,0.97); }
@keyframes shake { 10%,90%{transform:translateX(-2px)} 20%,80%{transform:translateX(4px)} 30%,50%,70%{transform:translateX(-6px)} 40%,60%{transform:translateX(6px)} }

/* --- Input Groups --- */
.input-group { position: relative; margin-bottom: 22px; }
.input-group.floating input { width: 100%; padding: 18px 48px 8px 48px; background: rgba(255,255,255,0.04); border: 1.5px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 15px; font-family: var(--font); transition: var(--transition); outline: none; }
.input-group.floating label { position: absolute; left: 48px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 15px; pointer-events: none; transition: all 0.25s cubic-bezier(0.4,0,0.2,1); background: transparent; padding: 0 6px; }
.input-group.floating input:focus + label, .input-group.floating input:not(:placeholder-shown) + label { top: 4px; left: 14px; font-size: 11px; color: var(--accent); background: var(--bg-primary); transform: none; }
.input-border { position: absolute; bottom: 0; left: 50%; width: 0; height: 2px; background: linear-gradient(90deg, var(--accent), var(--purple)); transition: all 0.3s; border-radius: 0 0 var(--radius-sm) var(--radius-sm); transform: translateX(-50%); }
.input-group.floating input:focus ~ .input-border { width: 100%; }
.input-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); font-size: 16px; transition: var(--transition); z-index: 2; }
.input-group.floating input:focus ~ .input-icon { transform: translateY(-50%) scale(1.2); }
.toggle-password { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px; padding: 4px; z-index: 2; transition: var(--transition); }
.toggle-password:hover { color: var(--text-primary); }

/* --- Password Strength --- */
.password-strength { height: 3px; background: rgba(255,255,255,0.05); border-radius: 3px; margin-top: 8px; overflow: hidden; }
.strength-fill { height: 100%; width: 0; border-radius: 3px; transition: all 0.4s; }
.strength-weak .strength-fill { width: 33%; background: var(--red); }
.strength-medium .strength-fill { width: 66%; background: var(--orange); }
.strength-strong .strength-fill { width: 100%; background: var(--green); }

/* --- Match Indicator --- */
.match-indicator { position: absolute; right: 48px; top: 50%; transform: translateY(-50%); font-size: 18px; opacity: 0; transition: var(--transition); }
.match-indicator.show { opacity: 1; }

/* --- Form Options --- */
.form-options { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; font-size: 13px; }
.checkbox-custom { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); cursor: pointer; user-select: none; }
.checkbox-custom input { display: none; }
.checkmark { width: 18px; height: 18px; border: 1.5px solid var(--border); border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: var(--transition); }
.checkbox-custom input:checked ~ .checkmark { background: var(--accent); border-color: var(--accent); }
.checkbox-custom input:checked ~ .checkmark::after { content: '\\2713'; color: #fff; font-size: 12px; }
.forgot-link, .link-glow { color: var(--accent); text-decoration: none; transition: var(--transition); }
.forgot-link:hover, .link-glow:hover { text-shadow: 0 0 10px var(--accent-glow); }

/* --- Buttons --- */
.btn { width: 100%; padding: 16px; border: none; border-radius: var(--radius-sm); font-size: 15px; font-weight: 700; font-family: var(--font); cursor: pointer; transition: var(--transition); display: flex; align-items: center; justify-content: center; gap: 10px; position: relative; overflow: hidden; }
.btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7); background-size: 200% 200%; color: #fff; animation: gradientShift 3s ease infinite; }
@keyframes gradientShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
.btn-primary:hover { transform: translateY(-3px); box-shadow: 0 12px 35px rgba(99,102,241,0.35); }
.btn-glow::after { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: linear-gradient(transparent, rgba(255,255,255,0.1), transparent); transform: rotate(45deg); animation: btnShine 3s ease-in-out infinite; }
@keyframes btnShine { 0%{transform:rotate(45deg) translateY(-100%)} 100%{transform:rotate(45deg) translateY(100%)} }
.btn-arrow { transition: transform 0.3s; }
.btn:hover .btn-arrow { transform: translateX(4px); }
.spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }

/* --- Divider --- */
.divider { display: flex; align-items: center; gap: 16px; margin: 24px 0; color: var(--text-muted); font-size: 13px; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }

/* --- Social Buttons --- */
.social-buttons { display: flex; gap: 12px; }
.btn-social { flex: 1; padding: 14px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition); display: flex; align-items: center; justify-content: center; }
.btn-social:hover { background: rgba(255,255,255,0.08); border-color: var(--border-hover); transform: translateY(-2px); }

/* --- Auth Footer --- */
.auth-footer { text-align: center; margin-top: 28px; font-size: 14px; color: var(--text-secondary); }

/* --- Toast --- */
.toast-container { position: fixed; top: 24px; right: 24px; z-index: 10000; display: flex; flex-direction: column; gap: 10px; }
.toast { padding: 14px 20px; background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 14px; box-shadow: var(--shadow); animation: toastIn 0.4s cubic-bezier(0.16,1,0.3,1); display: flex; align-items: center; gap: 10px; }
.toast.success { border-left: 3px solid var(--green); }
.toast.error { border-left: 3px solid var(--red); }
.toast.info { border-left: 3px solid var(--blue); }
@keyframes toastIn { from{opacity:0;transform:translateX(60px)} to{opacity:1;transform:translateX(0)} }
@keyframes toastOut { from{opacity:1;transform:translateX(0)} to{opacity:0;transform:translateX(60px)} }

/* ============================================
   DASHBOARD
   ============================================ */
.dashboard-body { background: var(--bg-primary); }
.dashboard-container { position: relative; z-index: 10; display: flex; min-height: 100vh; }

/* --- Sidebar --- */
.sidebar { width: 270px; background: rgba(8,8,25,0.95); backdrop-filter: blur(20px); border-right: 1px solid var(--border); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; height: 100vh; z-index: 100; transition: var(--transition); }
.admin-sidebar { border-right-color: rgba(239,68,68,0.15); }
.sidebar-header { padding: 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); }
.brand { display: flex; align-items: center; gap: 12px; }
.brand-icon { font-size: 28px; animation: spin 8s linear infinite; }
.brand-text { font-size: 22px; font-weight: 800; background: linear-gradient(135deg, var(--accent), var(--purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.admin-brand { background: linear-gradient(135deg, var(--red), var(--orange)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.sidebar-toggle { display: none; background: none; border: none; color: var(--text-secondary); font-size: 24px; cursor: pointer; }
.sidebar-nav { flex: 1; padding: 16px 0; overflow-y: auto; }
.nav-item { display: flex; align-items: center; gap: 14px; padding: 14px 24px; color: var(--text-secondary); text-decoration: none; font-size: 14px; font-weight: 500; transition: var(--transition); position: relative; border-left: 3px solid transparent; }
.nav-item:hover { color: var(--text-primary); background: rgba(99,102,241,0.08); }
.nav-item.active { color: var(--text-primary); background: rgba(99,102,241,0.12); border-left-color: var(--accent); }
.admin-sidebar .nav-item.active { border-left-color: var(--red); background: rgba(239,68,68,0.08); }
.nav-icon { font-size: 18px; width: 24px; text-align: center; }
.logout-item { margin-top: auto; border-top: 1px solid var(--border); border-left: none !important; }
.sidebar-footer { padding: 16px 20px; border-top: 1px solid var(--border); }
.user-card { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: var(--radius-sm); background: rgba(255,255,255,0.03); }
.user-avatar, .topbar-avatar, .profile-avatar-large { background: linear-gradient(135deg, var(--accent), var(--purple)); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff; flex-shrink: 0; }
.admin-avatar { background: linear-gradient(135deg, var(--red), var(--orange)) !important; }
.user-avatar { width: 40px; height: 40px; font-size: 16px; }
.topbar-avatar { width: 38px; height: 38px; font-size: 14px; }
.profile-avatar-large { width: 80px; height: 80px; font-size: 32px; margin: 0 auto 16px; }
.animate-pulse { animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 0%,100%{box-shadow:0 0 0 0 var(--accent-glow)} 50%{box-shadow:0 0 0 12px transparent} }
.user-info { display: flex; flex-direction: column; }
.user-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.user-role { font-size: 12px; color: var(--text-muted); }
.admin-role { color: var(--red) !important; }

/* --- Main --- */
.main-content { flex: 1; margin-left: 270px; padding: 0; min-height: 100vh; }
.topbar { display: flex; justify-content: space-between; align-items: center; padding: 20px 32px; background: rgba(6,6,19,0.8); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 50; }
.topbar-left { display: flex; align-items: center; gap: 16px; }
.mobile-toggle { display: none; background: none; border: none; color: var(--text-secondary); font-size: 24px; cursor: pointer; }
.page-title { font-size: 22px; font-weight: 700; }
.gradient-text { background: linear-gradient(135deg, var(--accent), var(--purple), var(--pink)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.gradient-text-admin { background: linear-gradient(135deg, var(--red), var(--orange)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.topbar-right { display: flex; align-items: center; gap: 16px; }
.search-box { position: relative; }
.search-input { padding: 10px 16px 10px 38px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: var(--radius-xs); color: var(--text-primary); font-size: 13px; font-family: var(--font); width: 200px; transition: var(--transition); outline: none; }
.search-input:focus { border-color: var(--accent); width: 260px; }
.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--text-muted); }
.icon-btn { position: relative; background: none; border: 1px solid var(--border); border-radius: var(--radius-xs); padding: 10px 12px; cursor: pointer; transition: var(--transition); font-size: 16px; color: var(--text-secondary); }
.icon-btn:hover { border-color: var(--accent); color: var(--text-primary); }
.notification-badge { position: absolute; top: -4px; right: -4px; width: 18px; height: 18px; background: var(--red); border-radius: 50%; font-size: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; animation: badgePop 0.3s ease-out; }
@keyframes badgePop { from{transform:scale(0)} to{transform:scale(1)} }
.admin-badge { padding: 8px 16px; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radius-xs); font-size: 12px; color: #fca5a5; font-weight: 600; }

/* --- Content Grid --- */
.content-grid { padding: 28px 32px; }
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 24px; }
.stat-card { padding: 24px; border-radius: var(--radius); display: flex; align-items: flex-start; gap: 16px; position: relative; overflow: hidden; animation: cardSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards; animation-delay: calc(var(--delay) * 0.1s); opacity: 0; transform: translateY(24px); }
@keyframes cardSlideUp { to{opacity:1;transform:translateY(0)} }
.stat-icon-wrap { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
.stat-icon-wrap.blue { background: rgba(59,130,246,0.15); }
.stat-icon-wrap.green { background: rgba(34,197,94,0.15); }
.stat-icon-wrap.orange { background: rgba(245,158,11,0.15); }
.stat-icon-wrap.purple { background: rgba(168,85,247,0.15); }
.red-glow { background: rgba(239,68,68,0.15) !important; }
.green-glow { background: rgba(34,197,94,0.15) !important; }
.blue-glow { background: rgba(59,130,246,0.15) !important; }
.orange-glow { background: rgba(245,158,11,0.15) !important; }
.stat-info { flex: 1; }
.stat-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
.stat-value { font-size: 30px; font-weight: 800; color: var(--text-primary); margin-top: 4px; }
.stat-trend { position: absolute; top: 16px; right: 16px; font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: var(--radius-xs); }
.stat-trend.up { color: var(--green); background: rgba(34,197,94,0.1); }

/* --- Glass Card --- */
.glass-card { background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: var(--radius); transition: var(--transition); }
.glass-card:hover { border-color: var(--border-hover); box-shadow: var(--shadow-glow); }

/* --- Middle / Bottom Row --- */
.middle-row { display: grid; grid-template-columns: 1.6fr 1fr; gap: 20px; margin-bottom: 24px; }
.card-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--border); }
.card-header h2 { font-size: 16px; font-weight: 700; }
.chart-tabs { display: flex; gap: 4px; }
.chart-tab { padding: 6px 14px; border: none; border-radius: var(--radius-xs); background: transparent; color: var(--text-muted); font-size: 12px; font-weight: 600; cursor: pointer; transition: var(--transition); font-family: var(--font); }
.chart-tab.active { background: var(--accent); color: #fff; }
.chart-area { padding: 24px; height: 240px; }
#activityChart { width: 100%; height: 100%; }
.profile-card { padding: 24px; text-align: center; }
.profile-header { margin-bottom: 20px; }
.profile-name { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
.profile-badge { display: inline-block; padding: 4px 14px; background: linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05)); border: 1px solid rgba(245,158,11,0.3); border-radius: 20px; font-size: 12px; color: var(--orange); font-weight: 600; }
.profile-stats { display: flex; justify-content: center; gap: 32px; padding: 20px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); margin-bottom: 20px; }
.profile-stat { text-align: center; }
.ps-value { display: block; font-size: 22px; font-weight: 800; color: var(--text-primary); }
.ps-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
.profile-info { text-align: left; }
.profile-info p { display: flex; align-items: center; gap: 10px; padding: 8px 0; font-size: 13px; color: var(--text-secondary); }
.bottom-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.activity-card .card-header .view-all { color: var(--accent); text-decoration: none; font-size: 13px; font-weight: 600; }
.activity-feed { padding: 16px 24px; }
.activity-item { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid rgba(100,100,255,0.04); animation: slideRight 0.5s calc(var(--i,0) * 0.1s) forwards; opacity: 0; transform: translateX(-20px); }
@keyframes slideRight { to{opacity:1;transform:translateX(0)} }
.activity-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; position: relative; }
.activity-dot::after { content: ''; position: absolute; inset: -3px; border-radius: 50%; border: 1px solid currentColor; opacity: 0.3; }
.activity-dot.green { background: var(--green); color: var(--green); }
.activity-dot.blue { background: var(--blue); color: var(--blue); }
.activity-dot.red { background: var(--red); color: var(--red); }
.activity-dot.purple { background: var(--purple); color: var(--purple); }
.activity-text { font-size: 13px; color: var(--text-secondary); }
.activity-time { font-size: 11px; color: var(--text-muted); margin-top: 2px; display: block; }
.quick-actions { padding: 16px 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.action-btn { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-secondary); text-decoration: none; font-size: 13px; font-weight: 500; transition: var(--transition); }
.action-btn:hover { background: rgba(99,102,241,0.08); border-color: var(--accent); color: var(--text-primary); transform: translateY(-4px); }
.action-icon { font-size: 28px; transition: var(--transition); }
.action-btn:hover .action-icon { transform: scale(1.2); }
.slide-in { animation: slideIn 0.6s cubic-bezier(0.16,1,0.3,1) forwards; }
@keyframes slideIn { from{opacity:0;transform:translateX(-20px)} to{opacity:1;transform:translateX(0)} }

/* ============================================
   ADMIN TABLE
   ============================================ */
.admin-section { margin-bottom: 24px; }
.admin-counter { font-size: 13px; color: var(--text-muted); font-weight: 600; }
.user-table-wrap { overflow-x: auto; }
.user-table { width: 100%; border-collapse: collapse; }
.user-table th { padding: 14px 20px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); font-weight: 700; border-bottom: 1px solid var(--border); }
.user-table td { padding: 16px 20px; border-bottom: 1px solid rgba(100,100,255,0.04); font-size: 14px; }
.user-row { animation: rowSlide 0.4s calc(var(--ri,0) * 0.06s) forwards; opacity: 0; }
@keyframes rowSlide { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.user-row:hover { background: rgba(99,102,241,0.05); }
.row-suspended { opacity: 0.5; }
.table-user { display: flex; align-items: center; gap: 12px; }
.table-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--purple)); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff; font-size: 14px; flex-shrink: 0; }
.table-avatar.admin-ring { box-shadow: 0 0 0 2px var(--red); }
.table-username { font-weight: 600; }
.td-email { color: var(--text-secondary); }
.td-center { text-align: center; }
.td-muted { color: var(--text-muted); font-size: 13px; }
.td-empty { text-align: center; color: var(--text-muted); padding: 40px !important; }
.role-badge { padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.role-admin { background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); }
.role-user { background: rgba(99,102,241,0.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.3); }
.status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
.status-dot.active { background: var(--green); box-shadow: 0 0 6px var(--green); }
.status-dot.suspended { background: var(--red); box-shadow: 0 0 6px var(--red); }
.td-actions { display: flex; gap: 6px; }
.action-btn-sm { width: 34px; height: 34px; border: 1px solid var(--border); border-radius: var(--radius-xs); background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: var(--transition); }
.action-btn-sm:hover { transform: translateY(-2px); }
.btn-suspend { color: var(--orange); }
.btn-suspend:hover { background: rgba(245,158,11,0.15); border-color: var(--orange); }
.btn-activate { color: var(--green); }
.btn-activate:hover { background: rgba(34,197,94,0.15); border-color: var(--green); }
.btn-promote { color: var(--purple); }
.btn-promote:hover { background: rgba(168,85,247,0.15); border-color: var(--purple); }
.btn-delete { color: var(--red); }
.btn-delete:hover { background: rgba(239,68,68,0.15); border-color: var(--red); }

.admin-info-card .admin-info-body { padding: 20px 24px; }
.admin-info-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(100,100,255,0.05); }
.admin-info-label { font-size: 13px; color: var(--text-muted); }
.admin-info-value { font-size: 13px; color: var(--text-primary); font-weight: 600; }

/* --- Responsive --- */
@media (max-width: 1024px) { .stats-row { grid-template-columns: repeat(2, 1fr); } .middle-row, .bottom-row { grid-template-columns: 1fr; } }
@media (max-width: 768px) { .sidebar { transform: translateX(-100%); } .sidebar.open { transform: translateX(0); } .main-content { margin-left: 0; } .mobile-toggle { display: block; } .content-grid { padding: 20px; } .stats-row { grid-template-columns: 1fr; } .search-box { display: none; } .auth-card { padding: 36px 24px; } }
`,

    js: () => `// =============================================
// NEXUS UI - Interactive Script
// =============================================
(function initParticles() {
    const canvas = document.getElementById('particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [], mouse = { x: null, y: null };
    const COUNT = 80, DIST = 120, COLORS = ['#6366f1','#8b5cf6','#a855f7','#3b82f6','#ec4899'];
    function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
    resize(); addEventListener('resize', resize);
    addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    class P {
        constructor() { this.r(); }
        r() { this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height; this.vx = (Math.random()-0.5)*0.8; this.vy = (Math.random()-0.5)*0.8; this.rad = Math.random()*2.5+1; this.color = COLORS[Math.floor(Math.random()*COLORS.length)]; this.a = Math.random()*0.5+0.2; }
        u() { this.x += this.vx; this.y += this.vy; if(this.x<0||this.x>canvas.width) this.vx*=-1; if(this.y<0||this.y>canvas.height) this.vy*=-1; if(mouse.x!==null){const dx=mouse.x-this.x,dy=mouse.y-this.y,d=Math.sqrt(dx*dx+dy*dy);if(d<200){this.x-=dx*0.005;this.y-=dy*0.005;}} }
        d() { ctx.beginPath(); ctx.arc(this.x,this.y,this.rad,0,Math.PI*2); ctx.fillStyle=this.color; ctx.globalAlpha=this.a; ctx.fill(); ctx.globalAlpha=1; }
    }
    for(let i=0;i<COUNT;i++) particles.push(new P());
    function animate() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        particles.forEach(p=>{p.u();p.d();});
        for(let i=0;i<particles.length;i++){for(let j=i+1;j<particles.length;j++){const dx=particles[i].x-particles[j].x,dy=particles[i].y-particles[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<DIST){ctx.beginPath();ctx.moveTo(particles[i].x,particles[i].y);ctx.lineTo(particles[j].x,particles[j].y);ctx.strokeStyle='rgba(99,102,241,'+(0.15*(1-d/DIST))+')';ctx.lineWidth=0.5;ctx.stroke();}}if(mouse.x!==null){const dx=particles[i].x-mouse.x,dy=particles[i].y-mouse.y,d=Math.sqrt(dx*dx+dy*dy);if(d<DIST){ctx.beginPath();ctx.moveTo(particles[i].x,particles[i].y);ctx.lineTo(mouse.x,mouse.y);ctx.strokeStyle='rgba(168,85,247,'+(0.3*(1-d/DIST))+')';ctx.lineWidth=1;ctx.stroke();}}}
        requestAnimationFrame(animate);
    }
    animate();
})();

function showToast(msg, type='info') {
    const c = document.getElementById('toastContainer'); if(!c) return;
    const t = document.createElement('div'); t.className = 'toast '+type;
    const icons = {success:'\\u2705',error:'\\u274C',info:'\\u2139\\uFE0F'};
    t.innerHTML = '<span>'+(icons[type]||'')+'</span><span>'+msg+'</span>';
    c.appendChild(t);
    setTimeout(()=>{t.style.animation='toastOut 0.4s forwards';setTimeout(()=>t.remove(),400);},3500);
}

function togglePassword(id) {
    const input = document.getElementById(id||'password'); if(!input) return;
    const g = input.closest('.input-group');
    const eo = g.querySelector('.eye-open'), ec = g.querySelector('.eye-closed');
    if(input.type==='password'){input.type='text';if(eo)eo.style.display='none';if(ec)ec.style.display='inline';}
    else{input.type='password';if(eo)eo.style.display='inline';if(ec)ec.style.display='none';}
}

const pwInput = document.getElementById('password');
const sBar = document.getElementById('strengthBar');
if(pwInput&&sBar){pwInput.addEventListener('input',function(){const v=this.value;let s=0;if(v.length>=6)s++;if(v.length>=10)s++;if(/[A-Z]/.test(v)&&/[0-9]/.test(v))s++;if(/[^A-Za-z0-9]/.test(v))s++;sBar.className='password-strength';if(v.length===0){}else if(s<=1)sBar.classList.add('strength-weak');else if(s<=2)sBar.classList.add('strength-medium');else sBar.classList.add('strength-strong');});}

const cInput = document.getElementById('confirm_password');
const mInd = document.getElementById('matchIndicator');
if(cInput&&mInd){cInput.addEventListener('input',function(){const pw=document.getElementById('password');if(pw&&this.value.length>0){if(this.value===pw.value){mInd.textContent='\\u2705';mInd.classList.add('show');}else{mInd.textContent='\\u274C';mInd.classList.add('show');}}else mInd.classList.remove('show');});}

document.querySelectorAll('.auth-form').forEach(f=>{f.addEventListener('submit',function(){const b=this.querySelector('.btn-primary');if(b){const txt=b.querySelector('.btn-text'),ld=b.querySelector('.btn-loader');if(txt)txt.style.display='none';if(ld)ld.style.display='inline-flex';b.disabled=true;b.style.opacity='0.7';}});});

function animateCounters(){document.querySelectorAll('[data-count]').forEach(el=>{const target=parseInt(el.dataset.count),prefix=el.dataset.prefix||'',dur=2000,start=performance.now();function u(now){const p=Math.min((now-start)/dur,1),eased=1-Math.pow(1-p,3),cur=Math.floor(eased*target);el.textContent=prefix+cur.toLocaleString();if(p<1)requestAnimationFrame(u);}requestAnimationFrame(u);});}

function drawChart(){const canvas=document.getElementById('activityChart');if(!canvas)return;const ctx=canvas.getContext('2d'),rect=canvas.parentElement.getBoundingClientRect();canvas.width=rect.width;canvas.height=rect.height;const data=[30,55,40,75,60,85,50],labels=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],max=Math.max(...data)*1.2,w=canvas.width,h=canvas.height,pad={t:20,r:20,b:30,l:40},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(100,100,255,0.06)';ctx.lineWidth=1;for(let i=0;i<=4;i++){const y=pad.t+(ch/4)*i;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();}const pts=data.map((v,i)=>({x:pad.l+(cw/(data.length-1))*i,y:pad.t+ch-(v/max)*ch}));const grad=ctx.createLinearGradient(0,pad.t,0,h);grad.addColorStop(0,'rgba(99,102,241,0.3)');grad.addColorStop(1,'rgba(99,102,241,0)');ctx.beginPath();ctx.moveTo(pts[0].x,h-pad.b);pts.forEach((p,i)=>{if(i===0){ctx.lineTo(p.x,p.y);return;}const prev=pts[i-1],c1=prev.x+(p.x-prev.x)/3,c2=p.x-(p.x-prev.x)/3;ctx.bezierCurveTo(c1,prev.y,c2,p.y,p.x,p.y);});ctx.lineTo(pts[pts.length-1].x,h-pad.b);ctx.closePath();ctx.fillStyle=grad;ctx.fill();ctx.beginPath();pts.forEach((p,i)=>{if(i===0){ctx.moveTo(p.x,p.y);return;}const prev=pts[i-1],c1=prev.x+(p.x-prev.x)/3,c2=p.x-(p.x-prev.x)/3;ctx.bezierCurveTo(c1,prev.y,c2,p.y,p.x,p.y);});ctx.strokeStyle='#6366f1';ctx.lineWidth=2.5;ctx.stroke();pts.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fillStyle='#6366f1';ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fillStyle='#0d0d2b';ctx.fill();});ctx.fillStyle='#555588';ctx.font='11px Inter,sans-serif';ctx.textAlign='center';pts.forEach((p,i)=>{ctx.fillText(labels[i],p.x,h-8);});}

function toggleSidebar(){const s=document.getElementById('sidebar');if(s)s.classList.toggle('open');}

document.querySelectorAll('.chart-tab').forEach(t=>{t.addEventListener('click',function(){document.querySelectorAll('.chart-tab').forEach(x=>x.classList.remove('active'));this.classList.add('active');drawChart();});});

window.addEventListener('DOMContentLoaded',()=>{setTimeout(animateCounters,600);setTimeout(drawChart,200);addEventListener('resize',drawChart);const g=document.querySelector('.page-title');if(g)showToast('Welcome! You are logged in.','success');});
`,

    requirements: () => `flask==3.1.1\n`,

    gitignore: () => `__pycache__/\n*.pyc\n*.pyo\n.env\n.venv/\nvenv/\nenv/\n*.db\n.DS_Store\nnode_modules/\n`,
  },
};

function getTemplate(pageType) {
  if (TEMPLATES[pageType]) return TEMPLATES[pageType];
  return TEMPLATES.login;
}

module.exports = { getTemplate, TEMPLATES };
