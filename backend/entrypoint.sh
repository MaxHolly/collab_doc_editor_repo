#!/usr/bin/env bash
# just one worker for cheap setup; if Redis added, increase workers
set -euo pipefail
alembic upgrade head
exec gunicorn \
  --worker-class eventlet \
  --workers "${WORKERS:-1}" \ 
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile - \
  wsgi:app
