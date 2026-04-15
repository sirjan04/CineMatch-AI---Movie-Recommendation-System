/**
 * The Movie Database (TMDB) API v3 — real catalog, posters, search.
 * https://developer.themoviedb.org/docs/getting-started
 */
import type { Movie } from "../types";

const BASE = "https://api.themoviedb.org/3";

/** Official TMDB movie genre ids → names (stable; matches /genre/movie/list). */
export const TMDB_GENRE_ID_TO_NAME: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

export const ALL_TMDB_GENRE_NAMES = [...new Set(Object.values(TMDB_GENRE_ID_TO_NAME))].sort();

export function getTmdbApiKey(): string | null {
  const k = import.meta.env.VITE_TMDB_API_KEY;
  return k && String(k).trim() ? String(k).trim() : null;
}

export class TmdbError extends Error {
  constructor(
    message: string,
    public code: "MISSING_KEY" | "HTTP" | "NETWORK",
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = getTmdbApiKey();
  if (!key) {
    throw new TmdbError("Add VITE_TMDB_API_KEY to frontend/.env (see .env.example).", "MISSING_KEY");
  }
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch {
    throw new TmdbError("Network error talking to TMDB.", "NETWORK");
  }
  if (!res.ok) {
    throw new TmdbError(`TMDB returned ${res.status}. Check your API key.`, "HTTP");
  }
  return res.json() as Promise<T>;
}

type ListResult = {
  id: number;
  title: string;
  overview: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  release_date?: string;
  poster_path: string | null;
  backdrop_path: string | null;
};

type ListResponse = { results: ListResult[] };

export function mapTmdbListItem(r: ListResult): Movie {
  const genres = (r.genre_ids ?? [])
    .map((id) => TMDB_GENRE_ID_TO_NAME[id])
    .filter(Boolean) as string[];
  const year = r.release_date ? Number(r.release_date.slice(0, 4)) : undefined;
  return {
    id: r.id,
    title: r.title || "Untitled",
    overview: r.overview || "",
    vote_average: r.vote_average ?? 0,
    vote_count: r.vote_count ?? 0,
    genres: genres.length ? genres : ["Unknown"],
    genre_ids: r.genre_ids ?? [],
    year: Number.isFinite(year) ? year : undefined,
    poster_path: r.poster_path,
    backdrop_path: r.backdrop_path,
  };
}

/** Merge multiple list fetches, dedupe by id. */
function mergeUnique(maps: Movie[][]): Movie[] {
  const byId = new Map<number, Movie>();
  for (const list of maps) {
    for (const m of list) {
      if (!byId.has(m.id)) byId.set(m.id, m);
    }
  }
  return [...byId.values()];
}

/**
 * Build a large real-movie catalog: popular, top rated, now playing, trending.
 */
export async function fetchTmdbCatalog(): Promise<Movie[]> {
  const pagesPopular = [1, 2, 3, 4, 5, 6];
  const pagesTop = [1, 2, 3, 4];
  const pagesNow = [1, 2];

  const [popular, topRated, nowPlaying, trending] = await Promise.all([
    Promise.all(
      pagesPopular.map((page) =>
        tmdbGet<ListResponse>("/movie/popular", { page: String(page) }).then((d) =>
          (d.results ?? []).map(mapTmdbListItem),
        ),
      ),
    ).then((chunks) => chunks.flat()),
    Promise.all(
      pagesTop.map((page) =>
        tmdbGet<ListResponse>("/movie/top_rated", { page: String(page) }).then((d) =>
          (d.results ?? []).map(mapTmdbListItem),
        ),
      ),
    ).then((chunks) => chunks.flat()),
    Promise.all(
      pagesNow.map((page) =>
        tmdbGet<ListResponse>("/movie/now_playing", { page: String(page) }).then((d) =>
          (d.results ?? []).map(mapTmdbListItem),
        ),
      ),
    ).then((chunks) => chunks.flat()),
    tmdbGet<ListResponse>("/trending/movie/week", {}).then((d) => (d.results ?? []).map(mapTmdbListItem)),
  ]);

  return mergeUnique([popular, topRated, nowPlaying, trending]);
}

export async function fetchTmdbTrendingWeek(): Promise<Movie[]> {
  const d = await tmdbGet<ListResponse>("/trending/movie/week", {});
  return (d.results ?? []).map(mapTmdbListItem);
}

export async function searchTmdbMovies(query: string, page = 1): Promise<Movie[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const d = await tmdbGet<ListResponse>("/search/movie", {
    query: q,
    page: String(page),
    include_adult: "false",
  });
  return (d.results ?? []).map(mapTmdbListItem);
}

type DetailResponse = {
  id: number;
  title: string;
  overview: string;
  vote_average: number;
  vote_count: number;
  release_date?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres?: { id: number; name: string }[];
};

export async function fetchTmdbMovieDetail(id: number): Promise<Movie> {
  const r = await tmdbGet<DetailResponse>(`/movie/${id}`, {});
  const genre_ids = (r.genres ?? []).map((g) => g.id);
  const mapped = mapTmdbListItem({
    id: r.id,
    title: r.title,
    overview: r.overview,
    vote_average: r.vote_average,
    vote_count: r.vote_count,
    genre_ids,
    release_date: r.release_date,
    poster_path: r.poster_path,
    backdrop_path: r.backdrop_path,
  });
  if (r.genres?.length) {
    mapped.genres = r.genres.map((g) => g.name);
  }
  return mapped;
}
