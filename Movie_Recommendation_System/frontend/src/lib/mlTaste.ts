import type { Movie, RatingsMap, UserPreferences } from "../types";

type Vec = number[];

function dot(a: Vec, b: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function l2(a: Vec): number {
  return Math.sqrt(dot(a, a));
}

function addScaled(out: Vec, a: Vec, k: number) {
  for (let i = 0; i < out.length; i++) out[i] += a[i] * k;
}

function mean(vs: Vec[]): Vec {
  const d = vs[0]?.length ?? 0;
  const out = Array.from({ length: d }, () => 0);
  for (const v of vs) addScaled(out, v, 1);
  for (let i = 0; i < d; i++) out[i] /= Math.max(1, vs.length);
  return out;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function seededRandom(seed: number) {
  let x = seed >>> 0;
  return () => {
    // xorshift32
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1_000_000) / 1_000_000;
  };
}

function buildFeatureSpace(movies: Movie[], prefs: UserPreferences) {
  const genreSet = new Set<string>();
  for (const m of movies) for (const g of m.genres) genreSet.add(g);
  // keep user's selected genres first for stability in explanations
  const selected = prefs.genres.filter((g) => genreSet.has(g));
  const rest = [...genreSet].filter((g) => !selected.includes(g)).sort();
  const genres = [...selected, ...rest];
  const index = new Map<string, number>();
  genres.forEach((g, i) => index.set(g, i));
  return { genres, index, dim: genres.length };
}

function movieVec(m: Movie, space: ReturnType<typeof buildFeatureSpace>): Vec {
  const v = Array.from({ length: space.dim + 1 }, () => 0); // +1 for normalized rating
  for (const g of m.genres) {
    const i = space.index.get(g);
    if (i != null) v[i] = 1;
  }
  v[space.dim] = clamp01((m.vote_average ?? 0) / 10);
  return v;
}

function userVec(space: ReturnType<typeof buildFeatureSpace>, prefs: UserPreferences): Vec {
  const v = Array.from({ length: space.dim + 1 }, () => 0);
  for (const g of prefs.genres) {
    const i = space.index.get(g);
    if (i != null) v[i] = 1;
  }
  // Mood nudges (simple + explainable)
  const moodBoost: Record<string, string[]> = {
    happy: ["Comedy", "Animation", "Family", "Romance"],
    thrill: ["Thriller", "Horror", "Action", "Crime", "Mystery"],
    romantic: ["Romance", "Drama", "Comedy"],
    chill: ["Drama", "Comedy", "Music"],
    epic: ["Adventure", "Fantasy", "Action", "Science Fiction"],
    dark: ["Horror", "Thriller", "Crime", "Mystery", "Drama"],
  };
  for (const g of moodBoost[prefs.mood] ?? []) {
    const i = space.index.get(g);
    if (i != null) v[i] += 0.35;
  }
  v[space.dim] = 0.5; // neutral rating prior for the user profile vector
  return v;
}

// ---------- K-Means (movies clustered by genres + rating) ----------

export type KMeansModel = {
  k: number;
  centroids: Vec[];
  labels: Map<number, number>; // movieId -> cluster
};

function nearestCentroid(v: Vec, centroids: Vec[]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < centroids.length; i++) {
    const c = centroids[i];
    let d = 0;
    for (let j = 0; j < v.length; j++) {
      const diff = v[j] - c[j];
      d += diff * diff;
    }
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function fitKMeansMovies(movies: Movie[], prefs: UserPreferences, k = 8, iters = 8): KMeansModel {
  const space = buildFeatureSpace(movies, prefs);
  const vecs = movies.map((m) => ({ id: m.id, v: movieVec(m, space) }));
  const rand = seededRandom(42);

  // init centroids by picking spaced indices
  const centroids: Vec[] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(rand() * vecs.length);
    centroids.push(vecs[idx].v.slice());
  }

  const labels = new Map<number, number>();
  for (let t = 0; t < iters; t++) {
    const buckets: Vec[][] = Array.from({ length: k }, () => []);
    for (const { id, v } of vecs) {
      const ci = nearestCentroid(v, centroids);
      labels.set(id, ci);
      buckets[ci].push(v);
    }
    for (let i = 0; i < k; i++) {
      if (buckets[i].length) centroids[i] = mean(buckets[i]);
    }
  }

  return { k, centroids, labels };
}

// ---------- Linear SVM (taste) trained from your ratings ----------

export type SvmModel = {
  w: Vec;
  b: number;
  trained: boolean;
};

export function fitLinearSvmFromRatings(
  movies: Movie[],
  prefs: UserPreferences,
  ratings: RatingsMap,
): { model: SvmModel; space: ReturnType<typeof buildFeatureSpace> } {
  const space = buildFeatureSpace(movies, prefs);
  const byId = new Map(movies.map((m) => [m.id, m]));

  const X: Vec[] = [];
  const y: number[] = [];

  for (const [idStr, r] of Object.entries(ratings)) {
    const id = Number(idStr);
    const m = byId.get(id);
    if (!m) continue;
    if (r >= 4) {
      X.push(movieVec(m, space));
      y.push(1);
    } else if (r <= 2) {
      X.push(movieVec(m, space));
      y.push(-1);
    }
  }

  // Need at least one positive and one negative
  const pos = y.filter((v) => v === 1).length;
  const neg = y.filter((v) => v === -1).length;
  if (pos < 1 || neg < 1 || X.length < 6) {
    return { model: { w: Array.from({ length: space.dim + 1 }, () => 0), b: 0, trained: false }, space };
  }

  // Pegasos-like SGD on hinge loss (simple, explainable)
  const d = space.dim + 1;
  const w = Array.from({ length: d }, () => 0);
  let b = 0;
  const lambda = 0.0008;
  const epochs = 14;
  let step = 0;
  const rand = seededRandom(7);

  for (let e = 0; e < epochs; e++) {
    // shuffle indices
    const idxs = Array.from({ length: X.length }, (_, i) => i).sort(() => rand() - 0.5);
    for (const i of idxs) {
      step++;
      const eta = 1 / (lambda * step);
      const xi = X[i];
      const yi = y[i];
      // regularize
      for (let j = 0; j < d; j++) w[j] *= 1 - eta * lambda;
      const margin = yi * (dot(w, xi) + b);
      if (margin < 1) {
        for (let j = 0; j < d; j++) w[j] += eta * yi * xi[j];
        b += eta * yi * 0.15;
      }
    }
  }

  return { model: { w, b, trained: true }, space };
}

export function svmScore(model: SvmModel, x: Vec): number {
  return dot(model.w, x) + model.b;
}

// ---------- Final recommender (KMeans + SVM) ----------

export type SmartPick = Movie & {
  score: number;
  tasteScore: number;   // 0-100 personal taste match %
  svmTrained: boolean;  // whether personal taste engine was active
  reasons: string[];
  debug?: { cluster: number; svm: number };
};

export function smartRecommend(
  movies: Movie[],
  prefs: UserPreferences,
  ratings: RatingsMap,
  limit = 18,
): SmartPick[] {
  const disliked = new Set(
    Object.entries(ratings)
      .filter(([, r]) => r <= 2)
      .map(([id]) => Number(id)),
  );

  const { model: svm, space } = fitLinearSvmFromRatings(movies, prefs, ratings);
  const kmeans = fitKMeansMovies(movies, prefs, 8, 7);
  const u = userVec(space, prefs);
  const userCluster = nearestCentroid(u, kmeans.centroids);

  // pick candidate pool: mostly same cluster, plus some global
  const sameCluster = movies.filter((m) => kmeans.labels.get(m.id) === userCluster);
  const global = movies;
  const pool = [...sameCluster, ...global].filter((m, i, arr) => {
    // dedupe by id
    if (arr.findIndex((x) => x.id === m.id) !== i) return false;
    // Strict genre filter: if the user explicitly selected genres, require at least one match
    if (prefs.genres.length > 0) {
      if (!m.genres.some(g => prefs.genres.includes(g))) return false;
    }
    return true;
  });

  const topUserGenres = prefs.genres.slice(0, 3);
  const out: SmartPick[] = [];

  for (const m of pool) {
    if (disliked.has(m.id)) continue;
    const x = movieVec(m, space);
    const cluster = kmeans.labels.get(m.id) ?? -1;
    const inCluster = cluster === userCluster;

    const cos = dot(u, x) / ((l2(u) * l2(x)) + 1e-9);
    const pop = clamp01((m.vote_average ?? 0) / 10) + Math.min(0.15, Math.log1p(m.vote_count ?? 0) / 40);
    const svmS = svm.trained ? svmScore(svm, x) : 0;

    // Combine signals
    let score = 2.1 * cos + 0.7 * pop + (inCluster ? 0.35 : 0) + (svm.trained ? 0.55 * svmS : 0);
    const r = ratings[m.id];
    if (r != null) score += 0.18 * (r / 5);

    // Taste score: blend genre match (cos) + SVM signal → normalise to 0-100
    const svmNorm   = svm.trained ? clamp01((svmS + 2) / 4) : 0;   // SVM raw → 0-1
    const tasteRaw  = svm.trained
      ? 0.5 * cos + 0.5 * svmNorm          // equal weight once trained
      : cos;                                // genre-match only before training
    const tasteScore = Math.round(clamp01(tasteRaw) * 100);

    const reasons: string[] = [];
    if (topUserGenres.length) reasons.push(`Because you like ${topUserGenres.slice(0, 2).join(" & ")}`);
    if (inCluster) reasons.push("Matches your taste profile");
    if (svm.trained) reasons.push("Predicted you’ll love this");
    reasons.push(`Strong TMDB score (${m.vote_average.toFixed(1)})`);

    out.push({ ...m, score, tasteScore, svmTrained: svm.trained, reasons: reasons.slice(0, 3), debug: { cluster: userCluster, svm: svmS } });
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

