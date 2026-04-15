import type { Movie } from "../types";

const TMDB_IMG = "https://image.tmdb.org/t/p";

export function posterUrl(m: Movie, size: "w342" | "w500" = "w500"): string {
  if (m.poster_path) {
    return `${TMDB_IMG}/${size}${m.poster_path}`;
  }
  const t = encodeURIComponent(m.title.slice(0, 24) || "Movie");
  return `https://placehold.co/500x750/12141a/9ca3b8/png?text=${t}`;
}

export function backdropUrl(m: Movie | null, size: "w780" | "w1280" = "w1280"): string | null {
  if (!m?.backdrop_path) return null;
  return `${TMDB_IMG}/${size}${m.backdrop_path}`;
}
