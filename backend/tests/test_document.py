from app.models import Document, DocumentCollaborator

def _auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}

def test_create_list_get_update_delete_document(client, auth_tokens, db_session):
    user_id, access, _ = auth_tokens

    # Create
    r = client.post("/api/documents", json={"title":"Doc A","content":{"ops":[{"insert":"hi"}]}},
                    headers=_auth_headers(access))
    assert r.status_code == 201
    doc_id = r.get_json()["id"]

    # Owner was added as collaborator
    collab = db_session.query(DocumentCollaborator).filter_by(document_id=doc_id, user_id=user_id).first()
    assert collab and collab.permission_level == "owner"

    # List
    r = client.get("/api/documents", headers=_auth_headers(access))
    assert r.status_code == 200
    docs = r.get_json()
    assert any(d["id"] == doc_id for d in docs)

    # Get
    r = client.get(f"/api/documents/{doc_id}", headers=_auth_headers(access))
    assert r.status_code == 200
    data = r.get_json()
    assert data["title"] == "Doc A"
    assert data["content"] == {"ops":[{"insert":"hi"}]}

    # Update
    r = client.put(f"/api/documents/{doc_id}",
                   json={"title":"Doc A2","content":{"ops":[{"insert":"ok"}]}},
                   headers=_auth_headers(access))
    assert r.status_code == 200

    # Confirm updated in DB
    d = db_session.get(Document, doc_id)
    assert d.title == "Doc A2"
    assert d.content == {"ops":[{"insert":"ok"}]}

    # Delete
    r = client.delete(f"/api/documents/{doc_id}", headers=_auth_headers(access))
    assert r.status_code in (204, 200, 202)  # your route returns 204
    assert db_session.get(Document, doc_id) is None

def test_permission_enforced(client, auth_tokens, second_user_tokens, db_session):
    owner_id, owner_token, _ = auth_tokens
    other_id, other_token, _ = second_user_tokens

    # Owner creates a doc
    r = client.post("/api/documents", json={"title":"Pvt","content":{}},
                    headers=_auth_headers(owner_token))
    doc_id = r.get_json()["id"]

    # Other user cannot access
    r = client.get(f"/api/documents/{doc_id}", headers=_auth_headers(other_token))
    assert r.status_code == 403

    # Grant 'viewer' by inserting collaborator row (no share endpoint yet)
    db_session.add(DocumentCollaborator(document_id=doc_id, user_id=other_id, permission_level="viewer"))
    db_session.commit()

    # Now allowed to GET
    r = client.get(f"/api/documents/{doc_id}", headers=_auth_headers(other_token))
    assert r.status_code == 200

    # But cannot update as viewer
    r = client.put(f"/api/documents/{doc_id}", json={"title":"hack"},
                   headers=_auth_headers(other_token))
    assert r.status_code == 403