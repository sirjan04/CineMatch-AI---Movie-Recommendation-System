import type { Movie } from "../types";

export function allGenreOptions(movies: Movie[]): string[] {
  const s = new Set<string>();
  for (const m of movies) {
    for (const g of m.genres) s.add(g);
  }
  return [...s].sort();
}

