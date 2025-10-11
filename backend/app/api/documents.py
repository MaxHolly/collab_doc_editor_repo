from functools import wraps
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from pydantic import ValidationError
from ..extensions import db
from ..models import Document, DocumentCollaborator
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

@bp.get("/documents/<int:doc_id>")
@jwt_required()
@require_doc_permission(("viewer","editor","owner"))
def get_document(doc_id: int):
    d = db.session.get(Document, doc_id)
    if not d: return jsonify({"message": "Not found"}), 404
    return jsonify({"id": d.id, "title": d.title, "content": d.content, "description": d.description,
                    "owner_id": d.owner_id, "updated_at": d.updated_at.isoformat()})

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
