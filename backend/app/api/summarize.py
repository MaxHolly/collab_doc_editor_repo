from flask import Blueprint, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db, limiter
from app.models import Document, DocumentCollaborator
from app.llm import summarize_text
from sqlalchemy import func

bp_summarize = Blueprint("summarize", __name__)

def _has_access(doc, uid: int) -> bool:
    if doc.owner_id == uid:
        return True
    return db.session.query(DocumentCollaborator.id).filter_by(
        document_id=doc.id, user_id=uid
    ).scalar() is not None

@bp_summarize.post("/documents/<int:doc_id>/summary")
@jwt_required()
@limiter.limit("2/minute")  # cheap guard; tune as you like
def summarize_doc(doc_id: int):
    uid = int(get_jwt_identity())
    doc = db.session.get(Document, doc_id)
    if not doc:
        return jsonify(message="Not found"), 404
    if not _has_access(doc, uid):
        return jsonify(message="Access denied"), 403

    try:
        content = getattr(doc, "content", None) or ""
        summary = summarize_text(content)
        doc.summary = summary
        doc.updated_at = func.now()  # bump timestamp
        db.session.commit()
        return jsonify(summary=summary)
    except Exception as e:
        current_app.logger.exception("summarize failed (doc_id=%s): %s", doc_id, e)
        return jsonify(message="Summarization failed"), 500
