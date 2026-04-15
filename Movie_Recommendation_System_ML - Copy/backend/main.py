"""
Movie Recommendation API — FastAPI + scikit-learn (K-Means, SVM) + TMDB.
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import db
import ml_engine
import tmdb_client
from config import get_settings
from ml_engine import fit_or_load_models, preferences_to_vector, score_movie, transform_user
from ml_engine import blend_rating_feedback, movie_genre_vector
from tmdb_client import GENRE_KEY_TO_ID, TMDB_GENRE_ID_TO_KEY, poster_url

app = FastAPI(title="MovieMind API", version="1.0.0")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    db.init_db()
    try:
        fit_or_load_models()
    except FileNotFoundError as e:
        print(f"Warning: ML dataset missing — {e}")


def _session_id(x_session: str | None) -> str:
    if x_session and x_session.strip():
        return x_session.strip()
    raise HTTPException(status_code=400, detail="Missing X-Session-Id header")


def _id_to_index() -> dict[int, int]:
    return {GENRE_KEY_TO_ID[k]: i for i, k in enumerate(ml_engine.GENRE_KEYS)}


# --- Schemas ---


class PreferencesIn(BaseModel):
    genres: list[str] = Field(default_factory=list)
    mood: str = "chill"
    language: str = "en"
    watch_history: str = ""


class RateIn(BaseModel):
    movie_id: int
    rating: float = Field(ge=1, le=5)
    genre_ids: list[int] | None = None


class MovieOut(BaseModel):
    id: int
    title: str
    overview: str | None
    poster_url: str | None
    backdrop_url: str | None
    vote_average: float
    vote_count: int
    genres: list[str]
    genre_ids: list[int] = Field(default_factory=list)
    release_date: str | None = None


class RecommendItem(MovieOut):
    score: float
    explanations: list[str]
    cluster_id: int
    svm_profile: str


def _normalize_movie(m: dict[str, Any]) -> MovieOut:
    genre_ids = [int(g["id"]) for g in m.get("genres") or []]
    if not genre_ids and m.get("genre_ids"):
        genre_ids = [int(x) for x in m["genre_ids"]]
    gnames = [g["name"] for g in m.get("genres") or []]
    if not gnames:
        for gid in genre_ids:
            key = TMDB_GENRE_ID_TO_KEY.get(int(gid))
            if key:
                li = ml_engine.GENRE_KEYS.index(key)
                gnames.append(ml_engine.GENRE_LABELS[li])
    return MovieOut(
        id=int(m["id"]),
        title=m.get("title") or "Untitled",
        overview=m.get("overview"),
        poster_url=poster_url(m.get("poster_path")),
        backdrop_url=poster_url(m.get("backdrop_path"), size="w780"),
        vote_average=float(m.get("vote_average") or 0),
        vote_count=int(m.get("vote_count") or 0),
        genres=gnames,
        genre_ids=genre_ids,
        release_date=m.get("release_date"),
    )


async def _enrich_movie_list(results: list[dict]) -> list[dict]:
    """Fetch full detail for genre names when missing."""
    out: list[dict] = []
    for r in results:
        if r.get("genre_ids") and not r.get("genres"):
            try:
                detail = await tmdb_client.movie_detail(int(r["id"]))
                r = {**r, **detail}
            except Exception:
                pass
        out.append(r)
    return out


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/preferences")
async def save_preferences(body: PreferencesIn, x_session_id: str | None = Header(None)) -> dict:
    sid = _session_id(x_session_id)
    db.save_preferences(sid, body.model_dump())
    return {"ok": True}


@app.get("/preferences")
async def get_preferences(x_session_id: str | None = Header(None)) -> dict:
    sid = _session_id(x_session_id)
    p = db.get_preferences(sid)
    if not p:
        return {
            "genres": [],
            "mood": "chill",
            "language": "en",
            "watch_history": "",
        }
    return p


@app.post("/rate")
async def rate_movie(body: RateIn, x_session_id: str | None = Header(None)) -> dict:
    sid = _session_id(x_session_id)
    db.set_rating(sid, body.movie_id, body.rating, body.genre_ids)
    return {"ok": True}


@app.get("/ratings")
async def list_ratings(x_session_id: str | None = Header(None)) -> dict:
    sid = _session_id(x_session_id)
    return {"ratings": db.get_ratings(sid)}


@app.post("/session")
async def new_session() -> dict[str, str]:
    return {"session_id": str(uuid.uuid4())}


@app.post("/bookmarks/{movie_id}")
async def bookmark_toggle(movie_id: int, x_session_id: str | None = Header(None)) -> dict:
    sid = _session_id(x_session_id)
    active = db.toggle_bookmark(sid, movie_id)
    return {"bookmarked": active}


@app.get("/bookmarks")
async def bookmarks_list(x_session_id: str | None = Header(None)) -> dict:
    sid = _session_id(x_session_id)
    return {"ids": list(db.get_bookmarks(sid))}


@app.post("/recent/{movie_id}")
async def recent_add(movie_id: int, x_session_id: str | None = Header(None)) -> dict:
    sid = _session_id(x_session_id)
    db.add_recent_view(sid, movie_id)
    return {"ok": True}


@app.get("/recent")
async def recent_list(x_session_id: str | None = Header(None)) -> dict:
    sid = _session_id(x_session_id)
    return {"ids": db.get_recent_views(sid)}


@app.get("/me")
async def me(x_session_id: str | None = Header(None)) -> dict:
    """Lightweight dashboard payload for the profile page."""
    sid = _session_id(x_session_id)
    return {
        "preferences": db.get_preferences(sid),
        "ratings": db.get_ratings(sid),
        "bookmarks": list(db.get_bookmarks(sid)),
        "recent": db.get_recent_views(sid),
    }


@app.get("/trending")
async def trending(window: str = "day") -> dict:
    if window not in ("day", "week"):
        window = "day"
    data = await tmdb_client.trending_movies(window)
    results = await _enrich_movie_list(data.get("results") or [])
    return {"results": [_normalize_movie(m).model_dump() for m in results[:20]]}


@app.get("/movies/search")
async def movies_search(
    q: str = Query(..., min_length=1),
    page: int = 1,
    genre_key: str | None = None,
    min_rating: float | None = None,
) -> dict:
    data = await tmdb_client.search_movies(q, page=page)
    results = await _enrich_movie_list(data.get("results") or [])
    movies: list[MovieOut] = []
    want_gid = GENRE_KEY_TO_ID.get(genre_key or "", None)
    for mraw in results:
        ids = [int(x) for x in (mraw.get("genre_ids") or [g["id"] for g in mraw.get("genres") or []])]
        if want_gid is not None and want_gid not in ids:
            continue
        mo = _normalize_movie(mraw)
        if min_rating is not None and mo.vote_average < min_rating:
            continue
        movies.append(mo)
    return {"results": [m.model_dump() for m in movies], "page": data.get("page", 1)}


@app.get("/movies/{movie_id}")
async def movie_get(movie_id: int, x_session_id: str | None = Header(None)) -> dict:
    raw = await tmdb_client.movie_detail(movie_id)
    m = _normalize_movie(raw).model_dump()
    sid = (x_session_id or "").strip() or None
    ratings_map = db.get_ratings_map(sid) if sid else {}
    m["your_rating"] = ratings_map.get(movie_id)
    m["bookmarked"] = movie_id in db.get_bookmarks(sid) if sid else False
    return m


@app.get("/recommend")
async def recommend(
    limit: int = Query(10, ge=1, le=25),
    x_session_id: str | None = Header(None),
) -> dict:
    sid = _session_id(x_session_id)
    prefs = db.get_preferences(sid) or {
        "genres": ["action", "thriller"],
        "mood": "thriller",
        "language": "en",
        "watch_history": "",
    }
    models = fit_or_load_models()
    idx_map = _id_to_index()
    base_vec = preferences_to_vector(prefs)
    ratings_rows = db.get_ratings(sid)
    user_vec = blend_rating_feedback(base_vec, ratings_rows, idx_map)
    cluster_id, svm_class, _ = transform_user(models, user_vec)

    disliked = {r["movie_id"] for r in ratings_rows if r["rating"] <= 2.0}

    genre_ids = [GENRE_KEY_TO_ID[g] for g in prefs.get("genres") or [] if g in GENRE_KEY_TO_ID]
    lang = (prefs.get("language") or "en").lower()
    params_extra: dict[str, Any] = {}
    if lang and lang != "any":
        params_extra["with_original_language"] = lang

    raw_movies: list[dict] = []
    pages = [1, 2, 3]
    if genre_ids:
        for p in pages:
            d = await tmdb_client.discover_movies(
                genre_ids=genre_ids, page=p, extra=params_extra or None
            )
            raw_movies.extend(d.get("results") or [])
    # broaden if thin
    if len(raw_movies) < 30:
        for p in pages:
            d = await tmdb_client.discover_movies(genre_ids=None, page=p, extra=params_extra or None)
            raw_movies.extend(d.get("results") or [])

    seen: set[int] = set()
    merged: list[dict] = []
    for r in raw_movies:
        mid = int(r["id"])
        if mid in seen or mid in disliked:
            continue
        seen.add(mid)
        merged.append(r)

    merged = await _enrich_movie_list(merged[:80])

    scored: list[tuple[float, dict, list[str]]] = []
    for r in merged:
        gids = [g["id"] for g in r.get("genres") or []] or r.get("genre_ids") or []
        if lang and lang != "any":
            olang = (r.get("original_language") or "").lower()
            if olang and olang != lang:
                continue
        mv = movie_genre_vector([int(x) for x in gids], idx_map)
        s, expl = score_movie(
            user_vec,
            mv,
            float(r.get("vote_average") or 0),
            int(r.get("vote_count") or 0),
            models,
            cluster_id,
            svm_class,
        )
        scored.append((s, r, expl))

    scored.sort(key=lambda x: -x[0])
    top = scored[:limit]
    out: list[dict] = []
    svm_label = ml_engine.GENRE_LABELS[svm_class]
    for s, r, expl in top:
        mo = _normalize_movie(r)
        out.append(
            RecommendItem(
                **mo.model_dump(),
                score=round(float(s), 4),
                explanations=expl[:3],
                cluster_id=cluster_id,
                svm_profile=svm_label,
            ).model_dump()
        )

    return {
        "recommendations": out,
        "meta": {
            "cluster_id": cluster_id,
            "svm_taste_profile": svm_label,
            "kmeans_clusters": int(models.kmeans.n_clusters),
        },
    }


@app.get("/genres")
async def list_genres() -> dict:
    return {
        "genres": [
            {"key": k, "label": ml_engine.GENRE_LABELS[i], "tmdb_id": GENRE_KEY_TO_ID[k]}
            for i, k in enumerate(ml_engine.GENRE_KEYS)
        ]
    }
