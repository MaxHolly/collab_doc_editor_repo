from datetime import datetime
from sqlalchemy import func, CheckConstraint, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from ..extensions import db
from argon2 import PasswordHasher

ph = PasswordHasher()

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.BigInteger, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)

    def set_password(self, raw: str) -> None:
        self.password_hash = ph.hash(raw)
    
    def check_password(self, raw: str) -> bool:
        try:
            return ph.verify(self.password_hash, raw)
        except Exception:
            return False

class Document(db.Model):
    __tablename__ = "documents"
    id = db.Column(db.BigInteger, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    content = db.Column(JSONB)  # store Quill Delta or Yjs snapshot
    owner_id = db.Column(db.BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)

Index("idx_documents_owner_id", Document.owner_id)

class DocumentCollaborator(db.Model):
    __tablename__ = "document_collaborators"
    document_id = db.Column(db.BigInteger, ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True)
    user_id = db.Column(db.BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    permission_level = db.Column(db.String(50), nullable=False)

    __table_args__ = (
        CheckConstraint("permission_level IN ('owner','editor','viewer')", name="chk_perm_level"),
        Index("idx_document_collaborators_user_id", "user_id"),
    )

class TokenBlocklist(db.Model):
    __tablename__ = "token_blocklist"
    id = db.Column(db.BigInteger, primary_key = True)
    jti = db.Column(db.String(36), index=True, nullable=False, unique=True)
    token_type = db.Column(db.String(10), nullable=False) # either "access" | "refresh"
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    user_id = db.Column(db.BigInteger, nullable=False)