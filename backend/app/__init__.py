import os
from pathlib import Path
from flask import Flask, jsonify
from dotenv import load_dotenv
from .extensions import db, jwt, CORS, socketio, limiter
from datetime import timedelta
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_limiter.errors import RateLimitExceeded


BASE_DIR = Path(__file__).resolve().parents[1]

def _parse_origins(val: str | None, default="*"):
    """
    Accepts None / "" / "*" / "http://a,https://b"
    Returns "*" or a list[str] of exact origins.
    """
    if not val:
        return default
    val = val.strip()
    if val == "*" or val == "":
        return "*"
    return [o.strip() for o in val.split(",") if o.strip()]

def create_app():
    app = Flask(__name__)

    # Detect tests
    testing = os.getenv("FLASK_ENV") == "testing" or os.getenv("PYTEST_CURRENT_TEST") is not None

    # Only load .env in non-test runs
    if not testing:
        load_dotenv(BASE_DIR / ".env")

    app.config.from_mapping(
        SQLALCHEMY_DATABASE_URI=os.getenv("DATABASE_URL"),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SECRET_KEY=os.getenv("SECRET_KEY", "dev"),
        JWT_SECRET_KEY=os.getenv("JWT_SECRET_KEY"),
        JWT_TOKEN_LOCATION=["headers", "query_string"],
        JWT_QUERY_STRING_NAME="token",
        JWT_HEADER_NAME="Authorization",
        JWT_HEADER_TYPE="Bearer",
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(minutes=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", "30"))),
        JWT_REFRESH_TOKEN_EXPIRES=timedelta(days=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", 30))),
        PREFERRED_URL_SCHEME=os.getenv("PREFERRED_URL_SCHEME", "http"),
    )
    # enable show ratelimit headers
    app.config.update(RATELIMIT_HEADERS_ENABLED=True)

    # Guardrail for missing DB URL in dev
    if not app.config["SQLALCHEMY_DATABASE_URI"]:
        raise RuntimeError("DATABASE_URL not set")

    # trust nginx/x-forwarded-* headers
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

    # cors: in prod we run same-origin via Nginx proxy, but keep this for dev
    cors_origins_env = os.getenv("CORS_ORIGINS")
    api_cors = _parse_origins(cors_origins_env, "*")
    CORS(app, resources={r"/api/*": {"origins": api_cors}}, supports_credentials=False)

    db.init_app(app)
    jwt.init_app(app)
    limiter.init_app(app)

    # socket.io: set exact accepted origins indepentently from REST CORS
    sio_origins_env = os.getenv("SOCKETIO_CORS_ORIGINS")
    sio_cors = _parse_origins(sio_origins_env, api_cors)

    # Redis is optional; I skip it to save costs
    redis_url = None if testing else os.getenv("REDIS_URL") or None
    socketio.init_app(
        app,
        message_queue=redis_url,          # None => single-process (fine for one worker)
        cors_allowed_origins=sio_cors,
        async_mode="eventlet",
        logger=True,
        engineio_logger=True,
    )

    # Import models/blueprints/handlers
    from . import models  # noqa
    from .api.auth import bp as auth_bp
    from .api.documents import bp as docs_bp
    from .api.users import bp_users
    from .api.sharing import bp_share
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(docs_bp, url_prefix="/api")
    app.register_blueprint(bp_users, url_prefix="/api")
    app.register_blueprint(bp_share, url_prefix="/api")
    from .realtime import docs as _  # noqa

    # wiring jwt token blocklist checking if token is blocked
    from .models import TokenBlocklist

    @jwt.token_in_blocklist_loader
    def _is_token_revoked(jwt_header, jwt_payload):
        """Return True if this token's JTI is in blocklist"""
        jti = jwt_payload["jti"]
        return db.session.query(TokenBlocklist.id).filter_by(jti=jti).scalar() is not None
    
    
    @jwt.revoked_token_loader
    def _revoked_token_response(jwt_header, jwt_payload):
        return {"message": "Token has been revoked"}, 401

    @jwt.expired_token_loader
    def _expired_token_response(jwt_header, jwt_payload):
        return {"message": "Token has expired"}, 401

    @jwt.invalid_token_loader
    def _invalid_token_response(err_msg):
        return {"message": "Invalid token", "detail": err_msg}, 422

    @jwt.unauthorized_loader
    def _missing_token_response(err_msg):
        return {"message": "Missing token", "detail": err_msg}, 401
    
    # app routes
    @app.errorhandler(RateLimitExceeded)
    def handle_429(e: RateLimitExceeded):
        resp = jsonify(
            message="Too many requests. Please wait a moment and try again.",
            detail=str(e),  # includes which limit was hit for logging
        )
        resp.status_code = 429
        return resp


    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app
