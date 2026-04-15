import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchTmdbMovieDetail } from "../api/tmdb";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { backdropUrl, posterUrl } from "../lib/poster";
import type { Movie } from "../types";

export function MovieDetail() {
  const { id } = useParams();
  const mid = Number(id);
  const { ratings, setRating, bookmarks, toggleBookmark, addRecent } = useApp();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || Number.isNaN(mid)) {
      setMovie(null);
      setLoading(false);
      return;
    }
    let c = false;
    setLoading(true);
    setError(null);
    fetchTmdbMovieDetail(mid)
      .then((m) => {
        if (!c) {
          setMovie(m);
          addRecent(m.id);
        }
      })
      .catch((e) => {
        if (!c) {
          setError((e as Error).message);
          setMovie(null);
        }
      })
      .finally(() => {
        if (!c) setLoading(false);
      });
    return () => {
      c = true;
    };
  }, [mid, id, addRecent]);

  if (loading && !movie) {
    return (
      <div className="animate-pulse text-mist">
        <div className="h-8 w-48 rounded bg-elevated" />
        <div className="mt-4 h-96 max-w-xs rounded-2xl bg-elevated" />
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="text-mist">
        <p>{error || "Movie not found."}</p>
        <p className="mt-2 text-sm">You need a valid VITE_TMDB_API_KEY in frontend/.env</p>
        <Link to="/browse" className="mt-4 inline-block text-glow hover:underline">
          Back to browse
        </Link>
      </div>
    );
  }

  const stars = ratings[movie.id] ?? 0;
  const bookmarked = bookmarks.has(movie.id);
  const bd = backdropUrl(movie);

  return (
    <motion.article initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden rounded-3xl border border-line bg-surface/30">
      {bd ? (
        <div
          className="relative h-40 bg-cover bg-center sm:h-56"
          style={{ backgroundImage: `linear-gradient(to bottom, transparent, #0a0b0f), url(${bd})` }}
        />
      ) : null}

      <div className="grid gap-8 p-6 md:grid-cols-[240px_1fr] md:p-8">
        <div className={bd ? "-mt-16 md:-mt-24" : ""}>
          <div className="overflow-hidden rounded-2xl border border-line bg-elevated shadow-card">
            <img src={posterUrl(movie)} alt={movie.title} className="w-full object-cover" />
          </div>
        </div>

        <div>
          <Link to="/browse" className="text-sm font-medium text-glow hover:underline">
            ← Browse
          </Link>
          <h1 className="mt-4 font-display text-3xl font-bold text-white md:text-4xl">{movie.title}</h1>
          <p className="mt-2 text-mist">
            {"\u2605"} {movie.vote_average.toFixed(1)} TMDB · {movie.vote_count.toLocaleString()} votes
            {movie.year ? ` · ${movie.year}` : ""}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {movie.genres.map((g) => (
              <span key={g} className="rounded-full border border-line bg-void px-3 py-1 text-xs text-mist">
                {g}
              </span>
            ))}
          </div>

          <p className="mt-6 leading-relaxed text-white/90">{movie.overview || "No overview."}</p>

          <div className="mt-8 flex flex-col gap-6 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-mist">Your rating</p>
              <p className="mt-1 text-xs text-mist">Stored locally in your browser</p>
              <div className="mt-2">
                <StarRating value={stars} onChange={(v) => setRating(movie.id, v)} />
              </div>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => toggleBookmark(movie.id)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold ${
                bookmarked
                  ? "bg-pop/20 text-pop ring-1 ring-pop/40"
                  : "border border-line bg-elevated text-white hover:border-pop/40"
              }`}
            >
              {bookmarked ? "Bookmarked" : "Bookmark"}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
