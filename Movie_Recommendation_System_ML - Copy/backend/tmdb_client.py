"""TMDB API client — all requests use the server-side API key."""
from __future__ import annotations

import httpx

from config import get_settings

GENRE_KEY_TO_ID: dict[str, int] = {
    "action": 28,
    "comedy": 35,
    "drama": 18,
    "horror": 27,
    "romance": 10749,
    "sci_fi": 878,
    "thriller": 53,
    "animation": 16,
}

TMDB_GENRE_ID_TO_KEY = {v: k for k, v in GENRE_KEY_TO_ID.items()}


async def tmdb_get(path: str, params: dict | None = None) -> dict:
    settings = get_settings()
    if not settings.tmdb_api_key:
        raise RuntimeError("TMDB_API_KEY is not set in backend .env")
    base = settings.tmdb_base_url.rstrip("/")
    url = f"{base}{path}"
    q = {"api_key": settings.tmdb_api_key, "language": "en-US"}
    if params:
        q.update(params)
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url, params=q)
        r.raise_for_status()
        return r.json()


def poster_url(path: str | None, size: str = "w500") -> str | None:
    if not path:
        return None
    settings = get_settings()
    return f"{settings.tmdb_image_base.rstrip('/')}/{size}{path}"


async def discover_movies(
    genre_ids: list[int] | None = None,
    min_vote_count: int = 80,
    page: int = 1,
    extra: dict | None = None,
) -> dict:
    params: dict[str, str | int] = {
        "sort_by": "popularity.desc",
        "page": page,
        "vote_count.gte": min_vote_count,
        "include_adult": "false",
    }
    if genre_ids:
        params["with_genres"] = ",".join(str(g) for g in genre_ids)
    if extra:
        for k, v in extra.items():
            if v is not None:
                params[str(k)] = v # type: ignore[assignment]
    return await tmdb_get("/discover/movie", params)


async def search_movies(query: str, page: int = 1) -> dict:
    return await tmdb_get(
        "/search/movie",
        {"query": query, "page": page, "include_adult": "false"},
    )


async def movie_detail(movie_id: int) -> dict:
    return await tmdb_get(f"/movie/{movie_id}")


async def trending_movies(time_window: str = "day") -> dict:
    return await tmdb_get(f"/trending/movie/{time_window}")
