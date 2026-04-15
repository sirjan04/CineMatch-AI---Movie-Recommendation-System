import { fetchTmdbCatalog, getTmdbApiKey, TmdbError } from "../api/tmdb";
import type { Movie } from "../types";

export type LoadResult =
  | { ok: true; movies: Movie[] }
  | { ok: false; error: string; code: TmdbError["code"] | "UNKNOWN" };

export async function loadMovies(): Promise<LoadResult> {
  if (!getTmdbApiKey()) {
    return {
      ok: false,
      error:
        "No TMDB API key. Copy frontend/.env.example to .env and set VITE_TMDB_API_KEY (free at themoviedb.org).",
      code: "MISSING_KEY",
    };
  }
  try {
    const movies = await fetchTmdbCatalog();
    return { ok: true, movies };
  } catch (e) {
    if (e instanceof TmdbError) {
      return { ok: false, error: e.message, code: e.code };
    }
    return { ok: false, error: (e as Error).message || "Failed to load movies", code: "UNKNOWN" };
  }
}
