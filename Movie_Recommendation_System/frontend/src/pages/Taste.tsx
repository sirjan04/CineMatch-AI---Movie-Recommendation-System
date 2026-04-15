import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import { ALL_TMDB_GENRE_NAMES } from "../api/tmdb";
import { MovieCard } from "../components/MovieCard";
import { useApp } from "../context/AppContext";
import { smartRecommend } from "../lib/mlTaste";

const MOODS = [
  { id: "happy",    label: "Feel-good",  icon: "😄" },
  { id: "thrill",   label: "Thrill",     icon: "😰" },
  { id: "romantic", label: "Romantic",   icon: "💕" },
  { id: "chill",    label: "Chill",      icon: "😌" },
  { id: "epic",     label: "Epic / Big", icon: "🚀" },
  { id: "dark",     label: "Dark",       icon: "🌑" },
];

export function Taste() {
  const { prefs, setPrefs, ratings, movies, loading } = useApp();
  const ratedCount = Object.keys(ratings).length;

  const likedCount    = Object.values(ratings).filter((r) => r >= 4).length;
  const dislikedCount = Object.values(ratings).filter((r) => r <= 2).length;
  const svmReady      = likedCount >= 3 && dislikedCount >= 3;

  function toggle(g: string) {
    const next = prefs.genres.includes(g)
      ? prefs.genres.filter((x) => x !== g)
      : [...prefs.genres, g];
    setPrefs({ ...prefs, genres: next });
  }

  // Live recommendations — recompute whenever prefs or ratings change
  const picks = useMemo(() => {
    if (loading || !movies.length || prefs.genres.length === 0) return [];
    return smartRecommend(movies, prefs, ratings, 12);
  }, [movies, loading, prefs, ratings]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">

      {/* ── Header ── */}
      <div>
        <h1 className="font-display text-3xl font-bold text-white md:text-4xl">Your Taste</h1>
        <p className="mt-2 text-mist">
          Pick genres and a mood — your recommendations update instantly below.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">

        {/* ── Left: Controls ── */}
        <div className="space-y-10">

          {/* Genres */}
          <section>
            <h2 className="font-display text-lg font-semibold text-white">Genres</h2>
            <p className="mt-1 text-sm text-mist">Select everything you enjoy watching.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {ALL_TMDB_GENRE_NAMES.map((g, i) => {
                const on = prefs.genres.includes(g);
                return (
                  <motion.button
                    key={g}
                    type="button"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.01 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => toggle(g)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      on
                        ? "border-glow bg-glow/15 text-glow shadow-glow"
                        : "border-line text-mist hover:border-glow/30 hover:text-white"
                    }`}
                  >
                    {on ? "✓ " : ""}{g}
                  </motion.button>
                );
              })}
            </div>
          </section>

          {/* Mood */}
          <section>
            <h2 className="font-display text-lg font-semibold text-white">Mood</h2>
            <p className="mt-1 text-sm text-mist">What kind of experience are you after?</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MOODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    setPrefs({ ...prefs, mood: prefs.mood === m.id ? "" : m.id })
                  }
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                    prefs.mood === m.id
                      ? "border-pop/50 bg-pop/10 text-pop"
                      : "border-line text-mist hover:border-line hover:bg-elevated hover:text-white"
                  }`}
                >
                  <span className="mr-2">{m.icon}</span>{m.label}
                </button>
              ))}
            </div>
          </section>

          {/* Personalisation status */}
          <div className="rounded-2xl border border-line bg-surface/40 p-4 text-sm text-mist">
            <p className="font-medium text-white">Personalisation status</p>
            <div className="mt-3 flex gap-4">
              <div className="flex-1">
                <div className="text-2xl font-bold text-white">{likedCount}</div>
                <div className="text-xs text-mist">Liked (4–5 ⭐)</div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-line overflow-hidden">
                  <div
                    className="h-full rounded-full bg-glow transition-all"
                    style={{ width: `${Math.min(100, (likedCount / 3) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-white">{dislikedCount}</div>
                <div className="text-xs text-mist">Disliked (1–2 ⭐)</div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-line overflow-hidden">
                  <div
                    className="h-full rounded-full bg-pop transition-all"
                    style={{ width: `${Math.min(100, (dislikedCount / 3) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-white">{ratedCount}</div>
                <div className="text-xs text-mist">Total rated</div>
              </div>
            </div>
            <p className="mt-3 text-xs">
              {svmReady
                ? "✅ Personalisation active — recommendations are tuned to your taste."
                : `Rate ${Math.max(0, 3 - likedCount)} more liked and ${Math.max(0, 3 - dislikedCount)} more disliked movies for fully personalised picks.`}
            </p>
          </div>
        </div>

        {/* ── Right: Live preview ── */}
        <div>
          <h2 className="font-display text-lg font-semibold text-white">
            Your picks
            {picks.length > 0 && (
              <span className="ml-2 rounded-full bg-glow/15 px-2.5 py-0.5 text-sm font-normal text-glow">
                {picks.length}
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-mist">Updates as you change your preferences.</p>

          <div className="mt-4 space-y-0">
            <AnimatePresence mode="popLayout">
              {loading ? (
                <p className="text-sm text-mist">Loading movies…</p>
              ) : prefs.genres.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-line bg-surface/30 p-6 text-center text-sm text-mist"
                >
                  <div className="text-3xl mb-2">🎬</div>
                  Select at least one genre to see your picks.
                </motion.div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {picks.map((m, i) => {
                    const scoreColor = m.svmTrained
                      ? m.tasteScore >= 70 ? "bg-emerald-400" : m.tasteScore >= 40 ? "bg-glow" : "bg-mist/40"
                      : "bg-sky-400";
                    return (
                      <div key={m.id} className="flex flex-col">
                        <MovieCard movie={m} index={i} showReasons />
                        {/* Taste Match bar */}
                        <div className="mt-1.5 px-0.5">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-mist">
                              {m.svmTrained ? "Taste match" : "Genre match"}
                            </span>
                            <span className={`text-[11px] font-bold ${
                              m.svmTrained
                                ? m.tasteScore >= 70 ? "text-emerald-400" : m.tasteScore >= 40 ? "text-glow" : "text-mist"
                                : "text-sky-400"
                            }`}>
                              {m.tasteScore}%
                            </span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-line overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${scoreColor}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${m.tasteScore}%` }}
                              transition={{ delay: i * 0.04, duration: 0.5, ease: "easeOut" }}
                            />
                          </div>
                          {m.svmTrained && (
                            <p className="mt-0.5 text-[9px] text-emerald-400/70">✦ Personalised</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
