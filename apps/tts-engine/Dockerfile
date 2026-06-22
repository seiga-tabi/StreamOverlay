FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SEOYA_SERVER_HOST=0.0.0.0 \
    SEOYA_SERVER_PORT=8787 \
    SE0YA_SERVER_HOST=0.0.0.0 \
    SE0YA_SERVER_PORT=8787 \
    VOICEVOX_BASE_URL=http://voicevox:50021

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p /app/output

EXPOSE 8787
CMD ["sh", "-c", "uvicorn app:app --host ${SEOYA_SERVER_HOST:-${SE0YA_SERVER_HOST:-0.0.0.0}} --port ${SEOYA_SERVER_PORT:-${SE0YA_SERVER_PORT:-8787}}"]
