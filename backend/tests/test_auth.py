def test_register_and_login_flow(client):
    # fresh user
    r = client.post("/api/register", json={"username":"alice","email":"alice@example.com","password":"pw"})
    assert r.status_code in (201, 409)

    r = client.post("/api/login", json={"email":"alice@example.com","password":"pw"})
    assert r.status_code == 200
    data = r.get_json()
    assert "access_token" in data and "refresh_token" in data and "user_id" in data

def test_login_wrong_password(client):
    client.post("/api/register", json={"username":"bob","email":"bob@example.com","password":"pw"})
    r = client.post("/api/login", json={"email":"bob@example.com","password":"nope"})
    assert r.status_code == 401

# tests/test_auth_sessions.py

def _auth_headers(t: str):
    return {"Authorization": f"Bearer {t}"}


def _register_and_login(client, username, email, password="pw"):
    client.post("/api/register", json={"username": username, "email": email, "password": password})
    r = client.post("/api/login", json={"email": email, "password": password})
    j = r.get_json()
    return j["user_id"], j["access_token"], j["refresh_token"]


def test_refresh_issues_new_access_token(client):
    _, access, refresh = _register_and_login(client, "bob", "bob@example.com")

    r = client.post("/api/refresh", headers=_auth_headers(refresh))
    assert r.status_code == 200
    j = r.get_json()
    assert "access_token" in j
    # not asserting token difference (signing time makes this usually different)


def test_logout_revokes_access_token(client):
    _, access, _ = _register_and_login(client, "carol", "carol@example.com")

    # logout current access token
    r = client.post("/api/logout", headers=_auth_headers(access))
    assert r.status_code == 200

    # same token should now be rejected by blocklist
    r = client.get("/api/me", headers=_auth_headers(access))
    assert r.status_code == 401
    assert "revoked" in r.get_json().get("message", "").lower()
