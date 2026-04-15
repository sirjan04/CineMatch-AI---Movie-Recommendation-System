"""SQLite persistence for preferences, ratings, bookmarks, and recent views."""
import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Generator

from config import get_settings


def _conn() -> sqlite3.Connection:
    settings = get_settings()
    path = Path(__file__).resolve().parent / settings.database_path
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = _conn()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS preferences (
                session_id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS ratings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                movie_id INTEGER NOT NULL,
                rating REAL NOT NULL,
                genres TEXT,
                UNIQUE(session_id, movie_id)
            );
            CREATE TABLE IF NOT EXISTS bookmarks (
                session_id TEXT NOT NULL,
                movie_id INTEGER NOT NULL,
                PRIMARY KEY (session_id, movie_id)
            );
            CREATE TABLE IF NOT EXISTS recent_views (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                movie_id INTEGER NOT NULL,
                viewed_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """
        )


def get_preferences(session_id: str) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT data FROM preferences WHERE session_id = ?", (session_id,)
        ).fetchone()
    if not row:
        return None
    return json.loads(row["data"])


def save_preferences(session_id: str, data: dict[str, Any]) -> None:
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO preferences (session_id, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(session_id) DO UPDATE SET
                data = excluded.data,
                updated_at = CURRENT_TIMESTAMP
            """,
            (session_id, json.dumps(data)),
        )


def set_rating(
    session_id: str, movie_id: int, rating: float, genres: list[int] | None = None
) -> None:
    genres_json = json.dumps(genres) if genres else None
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO ratings (session_id, movie_id, rating, genres)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(session_id, movie_id) DO UPDATE SET
                rating = excluded.rating,
                genres = COALESCE(excluded.genres, ratings.genres)
            """,
            (session_id, movie_id, rating, genres_json),
        )


def get_ratings(session_id: str) -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT movie_id, rating, genres FROM ratings WHERE session_id = ?",
            (session_id,),
        ).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        g = r["genres"]
        out.append(
            {
                "movie_id": int(r["movie_id"]),
                "rating": float(r["rating"]),
                "genre_ids": json.loads(g) if g else [],
            }
        )
    return out


def get_ratings_map(session_id: str) -> dict[int, float]:
    return {x["movie_id"]: x["rating"] for x in get_ratings(session_id)}


def toggle_bookmark(session_id: str, movie_id: int) -> bool:
    """Returns True if bookmarked after toggle, False if removed."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT 1 FROM bookmarks WHERE session_id = ? AND movie_id = ?",
            (session_id, movie_id),
        ).fetchone()
        if row:
            conn.execute(
                "DELETE FROM bookmarks WHERE session_id = ? AND movie_id = ?",
                (session_id, movie_id),
            )
            return False
        conn.execute(
            "INSERT OR IGNORE INTO bookmarks (session_id, movie_id) VALUES (?, ?)",
            (session_id, movie_id),
        )
        return True


def get_bookmarks(session_id: str) -> set[int]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT movie_id FROM bookmarks WHERE session_id = ?", (session_id,)
        ).fetchall()
    return {int(r["movie_id"]) for r in rows}


def add_recent_view(session_id: str, movie_id: int) -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT INTO recent_views (session_id, movie_id) VALUES (?, ?)",
            (session_id, movie_id),
        )
        # keep last 30
        conn.execute(
            """
            DELETE FROM recent_views WHERE session_id = ? AND id NOT IN (
                SELECT id FROM recent_views WHERE session_id = ?
                ORDER BY viewed_at DESC LIMIT 30
            )
            """,
            (session_id, session_id),
        )


def get_recent_views(session_id: str) -> list[int]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT movie_id FROM recent_views WHERE session_id = ?
            ORDER BY viewed_at DESC LIMIT 30
            """,
            (session_id,),
        ).fetchall()
    seen: set[int] = set()
    out: list[int] = []
    for r in rows:
        mid = int(r["movie_id"])
        if mid not in seen:
            seen.add(mid)
            out.append(mid)
    return out
