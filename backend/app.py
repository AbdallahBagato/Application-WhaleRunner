"""
Whale Runner - Score API (Tier 2)
A tiny Flask API that saves and serves game scores from PostgreSQL.
Teaching points: env-var config (no secrets in image), retry until DB is
ready, runs as non-root behind gunicorn, health endpoint for HEALTHCHECK.
"""
import os
import time

import psycopg2
from flask import Flask, jsonify, request

app = Flask(__name__)

DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "db"),          # <-- Docker DNS name!
    "port": int(os.environ.get("DB_PORT", "5432")),
    "dbname": os.environ.get("DB_NAME", "whalerunner"),
    "user": os.environ.get("DB_USER", "whale"),
    "password": os.environ.get("DB_PASSWORD", "changeme"),
}


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def init_db(retries: int = 30, delay: float = 2.0):
    """Create the scores table, retrying while Postgres boots."""
    for attempt in range(1, retries + 1):
        try:
            with get_conn() as conn, conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS scores (
                        id SERIAL PRIMARY KEY,
                        player VARCHAR(20) NOT NULL,
                        score INTEGER NOT NULL,
                        played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
            print("[init] scores table ready")
            return
        except psycopg2.OperationalError as exc:
            print(f"[init] DB not ready (attempt {attempt}/{retries}): {exc}")
            time.sleep(delay)
    raise RuntimeError("Database never became ready")


@app.get("/api/health")
def health():
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1")
        return jsonify(status="ok", db="up")
    except Exception:
        return jsonify(status="degraded", db="down"), 503


@app.get("/api/scores")
def top_scores():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT player, score, played_at FROM scores "
            "ORDER BY score DESC, played_at ASC LIMIT 10"
        )
        rows = cur.fetchall()
    return jsonify(
        [
            {"player": p, "score": s, "played_at": t.isoformat()}
            for (p, s, t) in rows
        ]
    )


@app.post("/api/scores")
def save_score():
    data = request.get_json(silent=True) or {}
    player = str(data.get("player", "anonymous")).strip()[:20] or "anonymous"
    try:
        score = int(data.get("score", 0))
    except (TypeError, ValueError):
        return jsonify(error="score must be an integer"), 400
    if score < 0 or score > 1_000_000:
        return jsonify(error="nice try ;)"), 400

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO scores (player, score) VALUES (%s, %s)",
            (player, score),
        )
    return jsonify(saved=True, player=player, score=score), 201


init_db()

if __name__ == "__main__":
    # Dev mode only; production runs under gunicorn (see Dockerfile)
    app.run(host="0.0.0.0", port=5000)
