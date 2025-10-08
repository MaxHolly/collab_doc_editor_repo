
def _auth_headers(t: str):
    return {"Authorization": f"Bearer {t}"}


def _register_and_login(client, username, email, password="pw"):
    client.post("/api/register", json={"username": username, "email": email, "password": password})
    r = client.post("/api/login", json={"email": email, "password": password})
    j = r.get_json()
    return j["user_id"], j["access_token"], j["refresh_token"]


def test_me_get_and_patch(client):
    uid, access, _ = _register_and_login(client, "alice", "alice@example.com")

    # GET /api/me
    r = client.get("/api/me", headers=_auth_headers(access))
    assert r.status_code == 200
    j = r.get_json()
    assert j["id"] == uid
    assert j["email"] == "alice@example.com"
    assert j["username"] == "alice"

    # PATCH /api/me
    r = client.patch("/api/me", json={"username": "alice2"}, headers=_auth_headers(access))
    assert r.status_code == 200

    # verify
    r = client.get("/api/me", headers=_auth_headers(access))
    j = r.get_json()
    assert j["username"] == "alice2"
