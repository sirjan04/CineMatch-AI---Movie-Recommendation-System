import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ALL_TMDB_GENRE_NAMES, searchTmdbMovies } from "../api/tmdb";
import { MovieCard } from "../components/MovieCard";
import { SkeletonGrid } from "../components/SkeletonGrid";
import { useApp } from "../context/AppContext";
import { allGenreOptions } from "../lib/genres";

export function Browse() {
  const { movies, loading, loadError } = useApp();
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const [minScore, setMinScore] = useState("");
  const [apiResults, setApiResults] = useState<typeof movies>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setApiResults([]);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const t = window.setTimeout(() => {
      searchTmdbMovies(term)
        .then((r) => {
          if (!cancelled) setApiResults(r);
        })
        .catch(() => {
          if (!cancelled) setApiResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q]);

  const genres = useMemo(() => {
    const s = new Set([...allGenreOptions(movies), ...ALL_TMDB_GENRE_NAMES]);
    return [...s].sort();
  }, [movies]);

  const baseList = q.trim().length >= 2 ? apiResults : movies;

  const filtered = useMemo(() => {
    const min = minScore === "" ? 0 : Number(minScore);
    return baseList.filter((m) => {
      if (genre && !m.genres.includes(genre)) return false;
      if (minScore !== "" && m.vote_average < min) return false;
      return true;
    });
  }, [baseList, genre, minScore]);

  return (
    <div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
        <h1 className="font-display text-3xl font-bold text-white md:text-4xl">Explore</h1>
        <p className="mt-2 text-mist">
          Type a title to search TMDB live, or filter the preloaded catalog by genre and score.
        </p>
      </motion.div>

      {loadError ? (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          {loadError}
        </p>
      ) : null}

      <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-line bg-surface/40 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[160px] flex-1">
          <label className="text-xs font-medium uppercase tracking-wide text-mist">Search TMDB</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="At least 2 characters…"
            className="mt-1 w-full rounded-xl border border-line bg-void px-3 py-2 text-sm text-white outline-none focus:border-glow/50"
          />
        </div>
        <div className="w-full sm:w-44">
          <label className="text-xs font-medium uppercase tracking-wide text-mist">Genre filter</label>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-void px-3 py-2 text-sm text-white outline-none focus:border-glow/50"
          >
            <option value="">All</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-28">
          <label className="text-xs font-medium uppercase tracking-wide text-mist">Min score</label>
          <input
            type="number"
            step="0.5"
            min={0}
            max={10}
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            placeholder="0–10"
            className="mt-1 w-full rounded-xl border border-line bg-void px-3 py-2 text-sm text-white outline-none focus:border-glow/50"
          />
        </div>
      </div>

      <p className="mb-4 text-sm text-mist">
        {searchLoading ? "Searching…" : `${filtered.length} titles`}
        {q.trim().length >= 2 ? " (TMDB search)" : " (catalog)"}
      </p>

      {loading && q.trim().length < 2 ? (
        <SkeletonGrid count={8} />
      ) : searchLoading && q.trim().length >= 2 ? (
        <SkeletonGrid count={8} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((m, i) => (
            <MovieCard key={m.id} movie={m} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

