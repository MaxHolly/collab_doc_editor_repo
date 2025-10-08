#!/usr/bin/env bash
set -euo pipefail
alembic upgrade head
exec gunicorn -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker \
  -w "${WORKERS:-1}" -b 0.0.0.0:8000 wsgi:app
