def _auth_headers(t: str):
    return {"Authorization": f"Bearer {t}"}


def _register_and_login(client, username, email, password="pw"):
    client.post("/api/register", json={"username": username, "email": email, "password": password})
    r = client.post("/api/login", json={"email": email, "password": password})
    j = r.get_json()
    return j["user_id"], j["access_token"]


def _create_doc(client, token, title="T", content=None):
    data = {"title": title}
    if content is not None:
        data["content"] = content
    r = client.post("/api/documents", json=data, headers=_auth_headers(token))
    assert r.status_code == 201
    return r.get_json()["id"]


def test_sharing_lifecycle_and_permissions(client):
    # Owner & collaborator
    owner_id, owner_tok = _register_and_login(client, "owner", "owner@example.com")
    collab_id, collab_tok = _register_and_login(client, "collab", "collab@example.com")

    # Owner creates document
    doc_id = _create_doc(client, owner_tok, title="Shared Doc", content={"ops":[{"insert":"hi\n"}]})

    # Owner lists collaborators (should include owner)
    r = client.get(f"/api/documents/{doc_id}/collaborators", headers=_auth_headers(owner_tok))
    assert r.status_code == 200
    rows = r.get_json()
    assert any(row["user_id"] == owner_id and row["permission_level"] in ("owner",) for row in rows)

    # Add collaborator as viewer
    r = client.post(
        f"/api/documents/{doc_id}/collaborators",
        json={"user_id": collab_id, "permission_level": "viewer"},
        headers=_auth_headers(owner_tok),
    )
    assert r.status_code == 200

    # List again: should include collaborator
    r = client.get(f"/api/documents/{doc_id}/collaborators", headers=_auth_headers(owner_tok))
    ids = [row["user_id"] for row in r.get_json()]
    assert collab_id in ids

    # Viewer cannot update document
    r = client.put(
        f"/api/documents/{doc_id}",
        json={"title": "collab change"},
        headers=_auth_headers(collab_tok),
    )
    assert r.status_code == 403

    # Owner promotes collaborator to editor
    r = client.patch(
        f"/api/documents/{doc_id}/collaborators/{collab_id}",
        json={"permission_level": "editor"},
        headers=_auth_headers(owner_tok),
    )
    assert r.status_code == 200

    # Editor can now update
    r = client.put(
        f"/api/documents/{doc_id}",
        json={"title": "edited by collaborator"},
        headers=_auth_headers(collab_tok),
    )
    assert r.status_code == 200

    # Remove collaborator
    r = client.delete(
        f"/api/documents/{doc_id}/collaborators/{collab_id}",
        headers=_auth_headers(owner_tok),
    )
    assert r.status_code in (200, 204)

    # Removed collaborator can no longer view
    r = client.get(f"/api/documents/{doc_id}", headers=_auth_headers(collab_tok))
    assert r.status_code == 403


def test_transfer_ownership(client):
    # Two users
    old_owner_id, old_owner_tok = _register_and_login(client, "o1", "o1@example.com")
    new_owner_id, new_owner_tok = _register_and_login(client, "o2", "o2@example.com")

    # Old owner creates doc
    doc_id = _create_doc(client, old_owner_tok, title="Transfer Me")

    # Transfer ownership to o2
    r = client.post(
        f"/api/documents/{doc_id}/transfer_ownership",
        json={"user_id": new_owner_id},
        headers=_auth_headers(old_owner_tok),
    )
    assert r.status_code == 200

    # Old owner should no longer be allowed to manage sharing (owner-only)
    r = client.post(
        f"/api/documents/{doc_id}/collaborators",
        json={"user_id": old_owner_id, "permission_level": "viewer"},
        headers=_auth_headers(old_owner_tok),
    )
    assert r.status_code == 403

    # New owner can manage sharing
    r = client.post(
        f"/api/documents/{doc_id}/collaborators",
        json={"user_id": old_owner_id, "permission_level": "viewer"},
        headers=_auth_headers(new_owner_tok),
    )
    assert r.status_code == 200

    # New owner can read/update doc
    r = client.get(f"/api/documents/{doc_id}", headers=_auth_headers(new_owner_tok))
    assert r.status_code == 200
    r = client.put(
        f"/api/documents/{doc_id}",
        json={"title": "new owner updated"},
        headers=_auth_headers(new_owner_tok),
    )
    assert r.status_code == 200