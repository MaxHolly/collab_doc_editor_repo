from functools import wraps
from typing import Optional, Dict

import jwt
from flask import request, current_app
from flask_socketio import emit

from ..extensions import db
from ..models import DocumentCollaborator

# In-memory map of Socket.IO sid -> user_id
_SID_USER: Dict[str, int] = {}


def _extract_token_from_handshake() -> Optional[str]:
    """Token is expected at the handshake, usually as ?token=<JWT>."""
    token = request.args.get("token")
    if token:
        return token

    # Header fallback (works for non-browser clients)
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth.split(None, 1)[1].strip()

    return None


def ws_on_connect_auth() -> Optional[int]:
    token = _extract_token_from_handshake()
    if not token:
        current_app.logger.debug("WS connect: missing token")
        return None
    try:
        payload = jwt.decode(
            token,
            current_app.config["JWT_SECRET_KEY"],
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        uid = int(payload["sub"])
    except Exception as e:
        current_app.logger.debug("WS connect: JWT decode failed: %s", e)
        return None

    _SID_USER[request.sid] = uid
    current_app.logger.debug("WS connect OK: sid=%s uid=%s", request.sid, uid)
    return uid


def ws_on_disconnect_cleanup() -> None:
    """Clean up sid mapping on disconnect."""
    uid = _SID_USER.pop(request.sid, None)
    current_app.logger.debug("WS disconnect: sid=%s uid=%s", request.sid, uid)


def ws_login_required(fn):
    """
    Decorator for Socket.IO events:
    Ensures the socket was authenticated at connect time.
    Injects 'user_id' as first arg to the handler.
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        uid = _SID_USER.get(request.sid)
        if not uid:
            emit("error", {"message": "unauthenticated"}, room=request.sid)
            return
        return fn(uid, *args, **kwargs)
    return wrapper


def document_access_required(levels=("viewer", "editor", "owner")):
    """
    Decorator that ensures the current user has one of the required
    permission levels for the given document_id in the event 'data'.
    Expects the wrapped function signature: (user_id, data, ...).
    Passes (user_id, doc_id, data, ...) to the final handler.
    """
    def deco(fn):
        @wraps(fn)
        def wrapper(user_id, data, *args, **kwargs):
            doc_id = (data or {}).get("document_id")
            if not doc_id:
                emit("error", {"message": "Missing document_id"}, room=request.sid)
                return

            collab = (
                db.session.query(DocumentCollaborator)
                .filter_by(document_id=doc_id, user_id=user_id)
                .first()
            )
            if not collab or collab.permission_level not in levels:
                emit("error", {"message": "Access denied"}, room=request.sid)
                return

            return fn(user_id, doc_id, data, *args, **kwargs)
        return wrapper
    return deco
