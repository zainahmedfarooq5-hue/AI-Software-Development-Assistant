from flask import Flask, render_template, request, redirect, url_for, session, jsonify
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
    print("\n" + "="*55)
    print(f"  Account data: {ACCOUNTS_FILE}")
    print(f"  Admin login:  admin / {ADMIN_PASSWORD}")
    print("="*55 + "\n")
    app.run(debug=True, host="0.0.0.0", port=5000)
