/** TMDB-backed movie (list or detail). */
export interface Movie {
  id: number;
  title: string;
  genres: string[];
  genre_ids: number[];
  overview: string;
  vote_average: number;
  vote_count: number;
  year?: number;
  poster_path: string | null;
  backdrop_path: string | null;
}

export interface UserPreferences {
  genres: string[];
  mood: string;
}

export type RatingsMap = Record<number, number>;
