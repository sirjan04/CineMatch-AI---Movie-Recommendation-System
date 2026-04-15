import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { posterUrl } from "../lib/poster";
import type { SmartPick } from "../lib/mlTaste";
import type { Movie } from "../types";

type Props = {
  movie: Movie | SmartPick;
  index?: number;
  showReasons?: boolean;
};

function hasReasons(m: Movie | SmartPick): m is SmartPick {
  return "reasons" in m && Array.isArray((m as SmartPick).reasons);
}

export function MovieCard({ movie, index = 0, showReasons }: Props) {
  const reasons = hasReasons(movie) ? movie.reasons : null;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, type: "spring", stiffness: 280, damping: 26 }}
      className="group"
    >
      <Link to={`/movie/${movie.id}`} className="block">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-elevated shadow-card transition-shadow duration-300 group-hover:border-glow/30 group-hover:shadow-glow">
          <div className="aspect-[2/3] overflow-hidden">
            <img
              src={posterUrl(movie)}
              alt={movie.title}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
            />
          </div>
          <div className="absolute right-2 top-2 rounded-full bg-void/85 px-2 py-0.5 text-xs font-semibold text-glow backdrop-blur">
            {"\u2605"} {movie.vote_average.toFixed(1)}
          </div>
        </div>
        <h3 className="mt-3 font-display text-base font-semibold leading-snug text-white group-hover:text-glow">
          {movie.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-mist">
          {movie.genres.slice(0, 3).join(" · ")}
          {movie.year ? ` · ${movie.year}` : ""}
        </p>
      </Link>
      {showReasons && reasons?.length ? (
        <ul className="mt-2 space-y-1 border-l-2 border-glow/40 pl-2 text-[11px] leading-relaxed text-mist">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
    </motion.article>
  );
}

