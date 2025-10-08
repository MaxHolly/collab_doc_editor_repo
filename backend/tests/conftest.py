import os
import sys
from pathlib import Path
from urllib.parse import urlparse, urlunparse
import pytest

from alembic.config import Config
from alembic import command
from psycopg import connect, sql, errors

# Ensure 'app' is importable and load .env for DATABASE_URL fallback
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from dotenv import load_dotenv
load_dotenv(BASE_DIR / ".env")

os.environ.setdefault("FLASK_ENV", "testing")
os.environ.setdefault("PYTEST_CURRENT_TEST", "true")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")

def _strip_sqlalchemy_driver(url: str) -> str:
    return url.replace("+psycopg", "")

def _ensure_database(db_url: str):
    """Create the target test DB if it doesn't exist."""
    parsed = urlparse(_strip_sqlalchemy_driver(db_url))
    dbname = parsed.path.lstrip("/") or "postgres"
    admin = parsed._replace(path="/postgres")
    admin_url = urlunparse(admin)

    with connect(admin_url) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,))
            exists = cur.fetchone() is not None
            if not exists:
                try:
                    cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(dbname)))
                except errors.InsufficientPrivilege:
                    raise RuntimeError(
                        f"Test DB '{dbname}' doesn't exist and current user can't CREATE DATABASE.\n"
                        f"Fix: ALTER ROLE <user> CREATEDB; or pre-create:\n"
                        f"  CREATE DATABASE {dbname} OWNER <user>;"
                    )

def _drop_database(db_url: str):
    parsed = urlparse(_strip_sqlalchemy_driver(db_url))
    dbname = parsed.path.lstrip("/") or "postgres"
    admin = parsed._replace(path="/postgres")
    admin_url = urlunparse(admin)
    try:
        with connect(admin_url) as conn:
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = %s AND pid <> pg_backend_pid()
                """, (dbname,))
                cur.execute(sql.SQL("DROP DATABASE IF EXISTS {}").format(sql.Identifier(dbname)))
    except errors.InsufficientPrivilege:
        # Non-fatal: leave the DB around in dev
        pass

@pytest.fixture(scope="session")
def test_db_url():
    base = os.environ.get("TEST_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not base:
        raise RuntimeError("Set TEST_DATABASE_URL or DATABASE_URL (via backend/.env or env vars).")
    if "TEST_DATABASE_URL" not in os.environ:
        parsed = urlparse(base)
        name = parsed.path.lstrip("/")
        parsed = parsed._replace(path=f"/{name}_test")
        base = urlunparse(parsed)
    return base

@pytest.fixture(scope="session", autouse=True)
def _prepare_database(test_db_url):
    """Create test DB and run Alembic migrations to head *before* any test/app starts."""
    _ensure_database(test_db_url)

    # IMPORTANT: ensure env.py picks the test DB
    os.environ["DATABASE_URL"] = test_db_url

    cfg = Config(str(BASE_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BASE_DIR / "migrations"))
    cfg.set_main_option("sqlalchemy.url", test_db_url)
    command.upgrade(cfg, "head")

    yield

    _drop_database(test_db_url)

@pytest.fixture()
def app(test_db_url, _prepare_database, monkeypatch):
    # Point app at the test DB and disable Redis before importing the app
    monkeypatch.setenv("DATABASE_URL", test_db_url)
    monkeypatch.delenv("REDIS_URL", raising=False)

    from app import create_app
    app = create_app()
    app.config.update(TESTING=True)
    return app

@pytest.fixture()
def client(app):
    return app.test_client()

@pytest.fixture()
def db_session(app):
    from app.extensions import db
    with app.app_context():
        yield db.session
        db.session.rollback()

@pytest.fixture()
def auth_tokens(client, db_session):
    """Register and log in a user; return (user_id, access_token, refresh_token)."""
    r = client.post("/api/register", json={"username":"u1","email":"u1@example.com","password":"secret"})
    assert r.status_code in (201, 409)
    r = client.post("/api/login", json={"email":"u1@example.com","password":"secret"})
    assert r.status_code == 200
    j = r.get_json()
    return j["user_id"], j["access_token"], j["refresh_token"]

@pytest.fixture()
def second_user_tokens(client):
    client.post("/api/register", json={"username":"u2","email":"u2@example.com","password":"secret"})
    r = client.post("/api/login", json={"email":"u2@example.com","password":"secret"})
    j = r.get_json()
    return j["user_id"], j["access_token"], j["refresh_token"]
