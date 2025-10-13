FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN pip install --no-cache-dir pip==24.2
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend .
RUN apt-get update && apt-get install -y --no-install-recommends dos2unix \
 && dos2unix entrypoint.sh \
 && chmod +x entrypoint.sh \
 && rm -rf /var/lib/apt/lists/*
 CMD ["bash","-lc","./entrypoint.sh"]