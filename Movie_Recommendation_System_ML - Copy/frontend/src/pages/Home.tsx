import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTmdbTrendingWeek, getTmdbApiKey } from "../api/tmdb";
import { MovieCard } from "../components/MovieCard";
import { SkeletonGrid } from "../components/SkeletonGrid";
import { useApp } from "../context/AppContext";
import { smartRecommend } from "../lib/mlTaste";
import type { Movie } from "../types";

export function Home() {
  const { movies, loading, loadError, reloadCatalog, prefs, ratings } = useApp();
  const [trending, setTrending] = useState<Movie[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  useEffect(() => {
    if (!getTmdbApiKey()) {
      setTrending([]);
      setTrendingLoading(false);
      return;
    }
    let c = false;
    setTrendingLoading(true);
    fetchTmdbTrendingWeek()
      .then((t) => {
        if (!c) setTrending(t.slice(0, 12));
      })
      .catch(() => {
        if (!c) setTrending([]);
      })
      .finally(() => {
        if (!c) setTrendingLoading(false);
      });
    return () => {
      c = true;
    };
  }, []);

  const picks = useMemo(() => {
    if (loading || !movies.length) return [];
    // Show more: 36 recommended with "why" explanations.
    return smartRecommend(movies, prefs, ratings, 36);
  }, [movies, loading, prefs, ratings]);

  const topRated = useMemo(() => {
    if (loading || !movies.length) return [];
    return [...movies].sort((a, b) => b.vote_average - a.vote_average).slice(0, 12);
  }, [movies, loading]);

  const ratedCount = Object.keys(ratings).length;

  return (
    <div className="space-y-14">
      {loadError ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-amber-100">
          <p className="font-display text-lg font-semibold text-amber-50">Cannot load real movies</p>
          <p className="mt-2 text-sm">{loadError}</p>
          <button
            type="button"
            onClick={reloadCatalog}
            className="mt-4 rounded-full bg-amber-400/20 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-400/30"
          >
            Retry
          </button>
        </div>
      ) : null}

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-line bg-surface/60 p-8 shadow-glow md:p-10"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-glow">TMDB · AI-POWERED · PERSONALISED</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight text-white md:text-5xl">
          Movie Recommendation System
        </h1>
        <p className="mt-4 max-w-2xl text-mist">
          Real movies and posters from TMDB. We match films to your taste using{" "}
          <span className="text-white/90">smart grouping</span> and a{" "}
          <span className="text-white/90">personal taste engine</span> that learns from your ratings.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/taste"
            className="rounded-full bg-glow px-6 py-2.5 text-sm font-semibold text-void shadow-glow transition hover:brightness-110"
          >
            Set taste
          </Link>
          <Link
            to="/browse"
            className="rounded-full border border-line bg-elevated px-6 py-2.5 text-sm font-semibold text-white hover:border-glow/40"
          >
            Browse & search
          </Link>
          <Link
            to="/saved"
            className="rounded-full border border-line bg-elevated px-6 py-2.5 text-sm font-semibold text-white hover:border-pop/40"
          >
            Ratings & saved ({ratedCount})
          </Link>
        </div>
        <p className="mt-4 text-sm text-mist">
          Tip: rate at least <span className="text-white/90">3 liked</span> and{" "}
          <span className="text-white/90">3 disliked</span> movies for the best personalised picks.
        </p>
      </motion.section>

      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">For you</h2>
            <p className="text-sm text-mist">36 picks with “why” explanations</p>
          </div>
          <Link to="/taste" className="text-sm font-medium text-glow hover:underline">
            Edit taste
          </Link>
        </div>
        {loading ? (
          <SkeletonGrid />
        ) : !movies.length ? (
          <p className="text-mist">Load the catalog with a valid TMDB key.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {picks.map((m, i) => (
              <MovieCard key={m.id} movie={m} index={i} showReasons />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-6 font-display text-2xl font-bold text-white">Trending this week</h2>
        {trendingLoading ? (
          <SkeletonGrid count={8} />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {trending.map((m, i) => (
              <MovieCard key={m.id} movie={m} index={i} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-6 font-display text-2xl font-bold text-white">Top rated in catalog</h2>
        {loading ? (
          <SkeletonGrid count={8} />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {topRated.map((m, i) => (
              <MovieCard key={m.id} movie={m} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

