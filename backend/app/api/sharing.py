from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import Document, DocumentCollaborator, User

bp_share = Blueprint("share", __name__)

def _owner_required(doc_id: int, uid: int) -> bool:
    d = db.session.get(Document, doc_id)
    if not d or d.owner_id != uid:
        return False
    return True

@bp_share.get("/documents/<int:doc_id>/collaborators")
@jwt_required()
def list_collaborators(doc_id):
    uid = int(get_jwt_identity())
    # allow owner or any collaborator to view
    collab = db.session.query(DocumentCollaborator).filter_by(document_id=doc_id, user_id=uid).first()
    if not collab:
        return jsonify(message="Access denied"), 403

    rows = (
        db.session.query(DocumentCollaborator, User.username, User.email)
        .join(User, User.id == DocumentCollaborator.user_id)
        .filter(DocumentCollaborator.document_id == doc_id)
        .all()
    )
    return jsonify([
        {"user_id": c.user_id, "username": uname, "email": email, "permission_level": c.permission_level}
        for c, uname, email in rows
    ])

@bp_share.post("/documents/<int:doc_id>/collaborators")
@jwt_required()
def add_collaborator(doc_id):
    uid = int(get_jwt_identity())
    if not _owner_required(doc_id, uid):
        return jsonify(message="Only owner can share"), 403

    data = request.get_json() or {}
    level = data.get("permission_level", "viewer")
    if level not in ("viewer", "editor"):
        return jsonify(message="Invalid permission_level"), 400
    
    # allow email in addition to user_id
    user_id = data.get("user_id")
    email = data.get("email")
    if not user_id and not email:
        return jsonify(message="user_id or email required"), 400
    
    if email and not user_id:
        user = db.session.query(User).filter_by(email=email).first()
        if not user:
            return jsonify(message="User with this email not found"), 404
        user_id = user.id

    # upsert
    c = db.session.query(DocumentCollaborator).filter_by(document_id=doc_id, user_id=user_id).first()
    if c:
        c.permission_level = level
    else:
        db.session.add(DocumentCollaborator(document_id=doc_id, user_id=user_id, permission_level=level))
    db.session.commit()
    return jsonify(msg="shared"), 200

@bp_share.patch("/documents/<int:doc_id>/collaborators/<int:target_id>")
@jwt_required()
def change_role(doc_id, target_id):
    uid = int(get_jwt_identity())
    if not _owner_required(doc_id, uid):
        return jsonify(message="Only owner can change roles"), 403
    data = request.get_json() or {}
    level = data.get("permission_level")
    if level not in ("viewer", "editor"):
        return jsonify(message="Invalid permission_level"), 400
    c = db.session.query(DocumentCollaborator).filter_by(document_id=doc_id, user_id=target_id).first()
    if not c:
        return jsonify(message="Not found"), 404
    c.permission_level = level
    db.session.commit()
    return jsonify(msg="updated"), 200

@bp_share.post("/documents/<int:doc_id>/transfer_ownership")
@jwt_required()
def transfer_ownership(doc_id):
    uid = int(get_jwt_identity())
    if not _owner_required(doc_id, uid):
        return jsonify(message="Only owner can transfer"), 403
    data = request.get_json() or {}
    new_owner_id = data.get("user_id")
    d = db.session.get(Document, doc_id)
    if not d:
        return jsonify(message="Not found"), 404
    d.owner_id = new_owner_id
    # ensure new owner has 'owner' collaborator record if you keep the invariant
    c = db.session.query(DocumentCollaborator).filter_by(document_id=doc_id, user_id=new_owner_id).first()
    if c: c.permission_level = "owner"
    else: db.session.add(DocumentCollaborator(document_id=doc_id, user_id=new_owner_id, permission_level="owner"))
    db.session.commit()
    return jsonify(msg="ownership_transferred"), 200

@bp_share.delete("/documents/<int:doc_id>/collaborators/<int:target_id>")
@jwt_required()
def remove_collaborator(doc_id, target_id):
    uid = int(get_jwt_identity())
    if not _owner_required(doc_id, uid):
        return jsonify(message="Only owner can remove"), 403
    c = db.session.query(DocumentCollaborator).filter_by(document_id=doc_id, user_id=target_id).first()
    if not c:
        return jsonify(message="Not found"), 404
    db.session.delete(c)
    db.session.commit()
    return "", 204