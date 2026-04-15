import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadMovies } from "../data/loadMovies";
import type { Movie, RatingsMap, UserPreferences } from "../types";

const PREFS_KEY = "cinepick_prefs";
const RATINGS_KEY = "cinepick_ratings";

const defaultPrefs: UserPreferences = {
  genres: ["Drama", "Science Fiction"],
  mood: "chill",
};

type Ctx = {
  movies: Movie[];
  loading: boolean;
  loadError: string | null;
  loadErrorCode: string | null;
  reloadCatalog: () => void;
  prefs: UserPreferences;
  setPrefs: (p: UserPreferences) => void;
  ratings: RatingsMap;
  setRating: (movieId: number, stars: number) => void;
  bookmarks: Set<number>;
  toggleBookmark: (id: number) => void;
  recentIds: number[];
  addRecent: (id: number) => void;
};

const AppContext = createContext<Ctx | null>(null);

function loadPrefs(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = { ...defaultPrefs, ...JSON.parse(raw) } as UserPreferences;
      p.genres = (p.genres ?? []).map((g) => (g === "Sci-Fi" ? "Science Fiction" : g));
      return p;
    }
  } catch {
    /* ignore */
  }
  return { ...defaultPrefs };
}

function loadRatings(): RatingsMap {
  try {
    const raw = localStorage.getItem(RATINGS_KEY);
    if (raw) return JSON.parse(raw) as RatingsMap;
  } catch {
    /* ignore */
  }
  return {};
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null);
  const [prefs, setPrefsState] = useState<UserPreferences>(loadPrefs);
  const [ratings, setRatingsState] = useState<RatingsMap>(loadRatings);
  const [bookmarks, setBookmarks] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem("cinepick_bm");
      if (raw) return new Set(JSON.parse(raw) as number[]);
    } catch {
      /* ignore */
    }
    return new Set();
  });
  const [recentIds, setRecentIds] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem("cinepick_recent");
      if (raw) return JSON.parse(raw) as number[];
    } catch {
      /* ignore */
    }
    return [];
  });
  const [reloadToken, setReloadToken] = useState(0);

  const reloadCatalog = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let c = false;
    setLoading(true);
    setLoadError(null);
    setLoadErrorCode(null);
    loadMovies().then((result) => {
      if (c) return;
      if (result.ok) {
        setMovies(result.movies);
      } else {
        setMovies([]);
        setLoadError(result.error);
        setLoadErrorCode(result.code);
      }
      setLoading(false);
    });
    return () => {
      c = true;
    };
  }, [reloadToken]);

  const setPrefs = useCallback((p: UserPreferences) => {
    setPrefsState(p);
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  }, []);

  const setRating = useCallback((movieId: number, stars: number) => {
    setRatingsState((prev) => {
      const next = { ...prev, [movieId]: stars };
      localStorage.setItem(RATINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleBookmark = useCallback((id: number) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("cinepick_bm", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const addRecent = useCallback((id: number) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 24);
      localStorage.setItem("cinepick_recent", JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      movies,
      loading,
      loadError,
      loadErrorCode,
      reloadCatalog,
      prefs,
      setPrefs,
      ratings,
      setRating,
      bookmarks,
      toggleBookmark,
      recentIds,
      addRecent,
    }),
    [
      movies,
      loading,
      loadError,
      loadErrorCode,
      reloadCatalog,
      prefs,
      setPrefs,
      ratings,
      setRating,
      bookmarks,
      toggleBookmark,
      recentIds,
      addRecent,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}
