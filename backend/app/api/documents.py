from functools import wraps
from flask import Blueprint, jsonify, request
from sqlalchemy import func
from flask_jwt_extended import jwt_required, get_jwt_identity
from pydantic import ValidationError
from ..extensions import db
from ..models import User, Document, DocumentCollaborator
from ..validation.schemas import CreateDocSchema, UpdateDocSchema
from .utils import _ve_to_json

bp = Blueprint("docs", __name__)

def require_doc_permission(levels=("viewer","editor","owner")):
    def deco(fn):
        @wraps(fn)
        def wrapper(doc_id, *args, **kwargs):
            user_id = int(get_jwt_identity())
            collab = db.session.query(DocumentCollaborator).filter_by(
                document_id=doc_id, user_id=user_id
            ).first()
            if not collab or collab.permission_level not in levels:
                return jsonify({"message": "Access denied"}), 403
            return fn(doc_id, *args, **kwargs)
        return wrapper
    return deco

@bp.post("/documents")
@jwt_required()
def create_document():
    user_id = int(get_jwt_identity())

    try:
        data = CreateDocSchema.model_validate(request.get_json() or {})
    except ValidationError as e:
        return _ve_to_json(e), 422
    
    title = data.title if data.title is not None else "Untitled Document"
    description = data.description if data.description is not None else ""
    content = data.content
    doc = Document(title=title, description=description, content=content, owner_id=user_id)
    db.session.add(doc); db.session.flush()
    db.session.add(DocumentCollaborator(document_id=doc.id, user_id=user_id, permission_level="owner"))
    db.session.commit()
    return jsonify({"id": doc.id, "title": doc.title, "description": doc.description}), 201

# TODO: remove old documents view before production deploy
@bp.get("/documents")
@jwt_required()
def list_documents():
    user_id = int(get_jwt_identity())
    docs = (
        db.session.query(Document)
        .join(DocumentCollaborator, Document.id==DocumentCollaborator.document_id)
        .filter(DocumentCollaborator.user_id==user_id)
        .order_by(Document.updated_at.desc())
        .all()
    )
    return jsonify([{
        "id": d.id, "title": d.title, "owner_id": d.owner_id,
        "updated_at": d.updated_at.isoformat()
    } for d in docs])

@bp.get("/documents/overview")
@jwt_required()
def list_documents_overview():
    uid = int(get_jwt_identity())
    dc = DocumentCollaborator

    # owned by user (with shared count)
    shared_counts_sq = (
        db.session.query(
            dc.document_id.label("doc_id"),
            func.count(dc.user_id).label("shared_count")
        )
        .join(Document, Document.id == dc.document_id)
        .filter(Document.owner_id == uid, dc.user_id != uid)
        .group_by(dc.document_id)
        .subquery()
    )

    owned_rows = (
        db.session.query(Document, shared_counts_sq.c.shared_count)
        .outerjoin(shared_counts_sq, Document.id == shared_counts_sq.c.doc_id)
        .filter(Document.owner_id == uid)
        .order_by(Document.updated_at.desc())
        .all()
    )

    mine = [
        {
            "id": d.id,
            "title": d.title,
            "updated_at": d.updated_at.isoformat(),
            "shared_count": sc if sc is not None else 0
        }
        for d, sc in owned_rows
    ]

    # shared with user (owned by others)
    u = User
    shared_rows = (
        db.session.query(
            Document,
            dc.permission_level,
            u.id.label("owner_id"),
            u.username.label("owner_username"),
            u.email.label("owner_email"),
        )
        .join(dc, dc.document_id == Document.id)
        .join(u, u.id == Document.owner_id)
        .filter(dc.user_id == uid, Document.owner_id != uid)
        .order_by(Document.updated_at.desc())
        .all()
    )

    shared_with_me = [
        {
            "id": d.id,
            "title": d.title,
            "updated_at": d.updated_at.isoformat(),
            "permission_level": pl,
            "owner": {
                "id": oid,
                "username": ouname,
                "email": oemail
            }
        }
        for d, pl, oid, ouname, oemail in shared_rows
    ]

    return jsonify({"mine": mine, "shared_with_me": shared_with_me})


@bp.get("/documents/<int:doc_id>")
@jwt_required()
@require_doc_permission(("viewer","editor","owner"))
def get_document(doc_id: int):
    d = db.session.get(Document, doc_id)
    if not d: return jsonify({"message": "Not found"}), 404

    uid = int(get_jwt_identity())
    collab = (
        db.session.query(DocumentCollaborator).filter_by(document_id=doc_id, user_id=uid).first()
    )
    perm = collab.permission_level if collab else ("owner" if d.owner_id == uid else None)

    owner = db.session.get(User, d.owner_id)
    owner_info = {
        "id": owner.id,
        "username": owner.username,
        "email": owner.email
    } if owner else {"id": d.owner_id}

    return jsonify({
        "id": d.id,
        "title": d.title,
        "summary": d.summary,
        "description": d.description,
        "owner_id": d.owner_id,
        "owner": owner_info,
        "permission_level": perm,
        "updated_at": d.updated_at.isoformat(),
    })

@bp.put("/documents/<int:doc_id>")
@jwt_required()
@require_doc_permission(("editor","owner"))
def update_document(doc_id: int):
    d = db.session.get(Document, doc_id)
    if not d: return jsonify({"message": "Not found"}), 404

    try:
        data = UpdateDocSchema.model_validate(request.get_json() or {})
    except ValidationError as e:
        return _ve_to_json(e), 422

    if data.title is not None:
        d.title = data.title
    if data.description is not None:
        d.description = data.description
    if data.content is not None:
        d.content = data.content
    if data.summary is not None:
        d.summary = data.summary
    d.updated_at = db.func.now()
    db.session.commit()
    return jsonify({"message":"updated"})

@bp.delete("/documents/<int:doc_id>")
@jwt_required()
@require_doc_permission(("owner",))
def delete_document(doc_id: int):
    d = db.session.get(Document, doc_id)
    if not d: return jsonify({"message": "Not found"}), 404
    db.session.delete(d); db.session.commit()
    return "", 204
