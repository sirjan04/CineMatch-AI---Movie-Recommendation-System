import { motion } from "framer-motion";
import { useMemo } from "react";
import { MovieCard } from "../components/MovieCard";
import { useApp } from "../context/AppContext";
import type { Movie } from "../types";

export function Saved() {
  const { movies, ratings, bookmarks, recentIds } = useApp();

  const rated = movies.filter((m) => ratings[m.id] != null);
  const bookmarked = movies.filter((m) => bookmarks.has(m.id));
  const recent = useMemo(() => {
    const out: Movie[] = [];
    for (const id of recentIds) {
      const m = movies.find((x) => x.id === id);
      if (m) out.push(m);
    }
    return out;
  }, [movies, recentIds]);

  return (
    <div className="space-y-12">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="font-display text-3xl font-bold text-white md:text-4xl">Saved</h1>
        <p className="mt-2 text-mist">Bookmarks, ratings, and recents stay in your browser (localStorage).</p>
      </motion.div>

      <section>
        <h2 className="font-display text-xl font-semibold text-white">Bookmarks</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {bookmarked.length === 0 ? (
            <p className="col-span-full text-sm text-mist">No bookmarks yet — open a movie and tap Bookmark.</p>
          ) : (
            bookmarked.map((m, i) => <MovieCard key={m.id} movie={m} index={i} />)
          )}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold text-white">Rated</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {rated.length === 0 ? (
            <p className="col-span-full text-sm text-mist">Rate titles on their detail pages.</p>
          ) : (
            rated.map((m, i) => <MovieCard key={m.id} movie={m} index={i} />)
          )}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold text-white">Recently viewed</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {recent.length === 0 ? (
            <p className="col-span-full text-sm text-mist">Open a few movies to fill this row.</p>
          ) : (
            recent.map((m, i) => <MovieCard key={m.id} movie={m} index={i} />)
          )}
        </div>
      </section>
    </div>
  );
}
