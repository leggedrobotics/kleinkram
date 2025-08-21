from flask import Flask, render_template, request, redirect, jsonify

app = Flask(__name__)

# Fake users in HitobitoProfile format
FAKE_USERS = [
    {
        "id": "1",
        "email": "admin@kleinkram.leggedrobotics.com",
        "displayName": "Kleinkram Admin User Nr. 1",
        "photo": "https://randomuser.me/api/portraits/men/8.jpg",
        "comment": "This user has admin access to Kleinkram. It sees all seeded projects."
    },
    {
        "id": "2",
        "email": "internal-user@kleinkram.leggedrobotics.com",
        "displayName": "Kleinkram User Nr. 2",
        "photo": "https://randomuser.me/api/portraits/women/71.jpg",
        "comment": "This user is an internal user of Kleinkram. She is part of an affiliation group and can create projects. This user sees no seeded projects."
    },
    {
        "id": "3",
        "email": "external-user@example.com",
        "displayName": "External Kleinkram User Nr. 3",
        "photo": "https://randomuser.me/api/portraits/women/88.jpg",
        "comment": "This user is an external user of Kleinkram. She cannot create any new projects, be default she sees no projects."
    },
]

# Store issued tokens
ACTIVE_TOKENS = {}

@app.route("/")
def home():
    """Homepage with a fake login screen"""
    return render_template("login.html", users=FAKE_USERS)

@app.route("/oauth/authorize")
def authorize():
    """OAuth2 Authorization Endpoint - User selects an account"""
    client_id = request.args.get("client_id")
    redirect_uri = request.args.get("redirect_uri")

    return render_template("login.html", users=FAKE_USERS, redirect_uri=redirect_uri)

@app.route("/login", methods=["POST"])
def login():
    """Handles login and redirects to the given redirect_uri with a fake code"""
    user_id = request.form.get("user_id")
    redirect_uri = request.form.get("redirect_uri")

    user = next((u for u in FAKE_USERS if u["id"] == user_id), None)
    if not user:
        return "User not found", 400

    fake_auth_code = f"fake-auth-code-{user['id']}"
    print(f"Generated fake auth code: {fake_auth_code} for user: {user['email']}")
    return redirect(f"{redirect_uri}?code={fake_auth_code}")

@app.route("/oauth/token", methods=["POST"])
def token():
    """OAuth2 Token Exchange - Returns a fake access token"""
    auth_code = request.form.get("code")

    # Extract user ID from fake auth code
    try:
        user_id = auth_code.replace("fake-auth-code-", "")
    except ValueError:
        return "Invalid authorization code", 400

    user = next((u for u in FAKE_USERS if u["id"] == user_id), None)
    if not user:
        return "Invalid user", 400

    # Generate a fake access token and store it
    access_token = f"fake-token-{user['id']}"
    ACTIVE_TOKENS[access_token] = user

    # Simulate OAuth2 token response
    response = {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": 3600,
    }
    return jsonify(response)

@app.route("/oauth/profile", methods=["GET"])
def profile():
    """Returns the user profile based on the access token"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing or invalid authorization header"}), 401

    access_token = auth_header.split(" ")[1]
    user = ACTIVE_TOKENS.get(access_token)

    if not user:
        return jsonify({"error": "Invalid or expired token"}), 401

    return jsonify(user)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)