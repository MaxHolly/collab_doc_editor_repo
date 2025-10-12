from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import User

bp_users = Blueprint("users", __name__)

@bp_users.get("/me")
@jwt_required()
def me_get():
    u = db.session.get(User, int(get_jwt_identity()))
    return jsonify(id=u.id, email=u.email, username=u.username, created_at=u.created_at.isoformat())

@bp_users.patch("/me")
@jwt_required()
def me_patch():
    uid = int(get_jwt_identity())
    u = db.session.get(User, uid)
    data = request.get_json() or {}
    if "username" in data and data["username"]:
        u.username = data["username"]
    db.session.commit()
    return jsonify(msg="updated")

@bp_users.get("/users/search")
@jwt_required()
def user_search():
    uid = int(get_jwt_identity())
    q = (request.args.get("q") or "").strip()
    if not q or len(q) < 5:
        return jsonify([]) # require at least 5 chars for query
    rows = (
        db.session.query(User.id, User.username, User.email)
        .filter(User.email.ilike(f"%{q}%"), User.id != uid)
        .order_by(User.email.asc())
        .limit(10)
        .all()
    )
    return jsonify([{"id": r.id, "username": r.username, "email": r.email} for r in rows])
