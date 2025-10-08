from flask import request
from flask_socketio import join_room, leave_room, emit

from ..extensions import socketio, db
from ..models import Document
from app.decorators.socketio_auth import (
    ws_on_connect_auth,
    ws_on_disconnect_cleanup,
    ws_login_required,
    document_access_required,
)


@socketio.on("connect")
def handle_connect():
    from flask import request, current_app
    current_app.logger.info("WS connect query args: %s", dict(request.args))
    ok = ws_on_connect_auth()
    if not ok:
        current_app.logger.info("WS connect refused (auth failed)")
        return False


@socketio.on("disconnect")
def handle_disconnect():
    ws_on_disconnect_cleanup()


@socketio.on("join_document")
@ws_login_required
@document_access_required(["viewer", "editor", "owner"])
def handle_join_document(user_id, doc_id, data):
    room = f"doc_{doc_id}"
    join_room(room)

    doc = db.session.get(Document, doc_id)
    if doc:
        # Send snapshot only to this client
        emit("load_document_content", {"title": doc.title, "content": doc.content}, room=request.sid)
        # Notify others in the room
        emit("user_joined", {"user_id": user_id}, to=room, include_self=False)


@socketio.on("leave_document")
@ws_login_required
def handle_leave_document(user_id, data):
    doc_id = int((data or {}).get("document_id", 0))
    if doc_id:
        leave_room(f"doc_{doc_id}")


@socketio.on("document_change")
@ws_login_required
@document_access_required(["editor", "owner"])
def handle_document_change(user_id, doc_id, data):
    new_content = (data or {}).get("content")

    doc = db.session.get(Document, doc_id)
    if not doc:
        emit("error", {"message": "Document not found"}, room=request.sid)
        return

    doc.content = new_content
    db.session.commit()

    emit(
        "document_updated",
        {"document_id": doc_id, "content": new_content, "by_user_id": user_id},
        to=f"doc_{doc_id}",
        include_self=False,
    )
