from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt, get_jwt_identity
from pydantic import ValidationError
from ..extensions import db, limiter
from ..models import User, TokenBlocklist
from ..validation.schemas import RegisterSchema, LoginSchema
from .utils import _ve_to_json

bp = Blueprint("auth", __name__)

@bp.post("/register")
@limiter.limit("5 per minute")
def register():
    try:
        data = RegisterSchema.model_validate(request.get_json() or {})
    except ValidationError as e:
        return _ve_to_json(e), 422

    username, email, password = data.username, data.email, data.password
    if not all([username, email, password]):
        return jsonify({"message": "Missing credentials"}), 400
    if db.session.query(User).filter((User.username==username)|(User.email==email)).first():
        return jsonify({"message": "User or email exists"}), 409
    u = User(username=username, email=email)
    u.set_password(password)
    db.session.add(u); db.session.commit()
    return jsonify({"message": "registered"}), 201

@bp.post("/login")
@limiter.limit("3 per minute")
def login():
    try:
        data = LoginSchema.model_validate(request.get_json() or {})
    except ValidationError as e:
        return _ve_to_json(e), 422

    email, password = data.email, data.password
    u = db.session.query(User).filter_by(email=email).first()
    if not u or not u.check_password(password):
        return jsonify({"message": "Invalid credentials"}), 401
    access = create_access_token(identity=str(u.id))
    refresh = create_refresh_token(identity=str(u.id))
    return jsonify({"access_token": access, "refresh_token": refresh, "user_id": u.id})

@bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    uid = int(get_jwt_identity())
    new_access = create_access_token(identity=str(uid))
    return jsonify(access_token=new_access), 200

@bp.post("/logout")
@jwt_required()
def logout():
    j = get_jwt()
    db.session.add(
        TokenBlocklist(
        jti=j["jti"], token_type=j["type"], user_id=int(get_jwt_identity())
        )
    )
    db.session.commit()
    return jsonify(msg="logged out current token"), 200



    