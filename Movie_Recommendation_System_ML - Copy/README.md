# CinePick — React + TMDB

Real **movies, posters, vote averages, overviews, and search** come from **[The Movie Database (TMDB)](https://www.themoviedb.org/)**. Your **star ratings**, **bookmarks**, and **taste** (genres + mood) are stored in the **browser** (`localStorage`).

There is **no fake title list** in the app anymore. You need a **free TMDB API v3 key**.

## Setup

1. Create an account at [themoviedb.org](https://www.themoviedb.org/), then **Settings → API** and copy the **v3** key.
2. In the frontend folder:

```powershell
cd frontend
copy .env.example .env
```

3. Edit `frontend/.env`:

```env
VITE_TMDB_API_KEY=your_key_here
```

4. Install and run:

```powershell
npm install
npm run dev
```

Open **http://127.0.0.1:5173**

Restart `npm run dev` after changing `.env`.

## What loads from TMDB

- **Catalog**: merged from *popular*, *top rated*, *now playing*, and *trending (week)* (several pages, deduped).
- **Trending row** on Home: `/trending/movie/week`.
- **Browse search**: `/search/movie` (live as you type).
- **Movie page**: `/movie/{id}` for full detail, backdrop, genres.

## Ratings

1–5 stars are **yours on this device** only (not sent to TMDB). They **feed the recommender** (genre + mood + your history).

## Optional: old Python backend

The `backend/` folder (FastAPI + scikit-learn) is **not** used by this frontend. You can delete it or keep it as a separate experiment.

## TMDB attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
