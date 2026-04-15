"""
Lightweight, explainable recommendation helpers using scikit-learn only.

- K-Means clusters synthetic "users" by genre preference vectors; the active user
  is assigned to the nearest cluster for collaborative-style explanations.
- SVM (linear kernel) predicts a dominant-genre taste class from the same vector
  space, used to weight candidate movies.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

# Must match TMDB genre mapping in tmdb_client.GENRE_KEY_TO_ID
GENRE_KEYS = [
    "action",
    "comedy",
    "drama",
    "horror",
    "romance",
    "sci_fi",
    "thriller",
    "animation",
]

MOOD_GENRE_BOOST: dict[str, dict[str, float]] = {
    "happy": {"comedy": 0.35, "animation": 0.25, "romance": 0.15},
    "thriller": {"thriller": 0.4, "horror": 0.2, "action": 0.15},
    "romantic": {"romance": 0.45, "drama": 0.2, "comedy": 0.1},
    "chill": {"drama": 0.25, "comedy": 0.2, "romance": 0.15},
    "adventure": {"action": 0.35, "sci_fi": 0.2, "animation": 0.1},
    "dark": {"horror": 0.35, "thriller": 0.25, "drama": 0.15},
}

GENRE_LABELS = [
    "Action",
    "Comedy",
    "Drama",
    "Horror",
    "Romance",
    "Sci-Fi",
    "Thriller",
    "Animation",
]


@dataclass
class FittedModels:
    scaler: StandardScaler
    kmeans: KMeans
    svm: SVC
    synthetic: pd.DataFrame


_models: FittedModels | None = None


def _data_path() -> Path:
    return Path(__file__).resolve().parent / "data" / "synthetic_users.csv"


def load_synthetic_users() -> pd.DataFrame:
    path = _data_path()
    if not path.exists():
        raise FileNotFoundError(f"Missing sample dataset: {path}")
    df = pd.read_csv(path)
    for c in GENRE_KEYS:
        if c not in df.columns:
            raise ValueError(f"synthetic_users.csv must include column '{c}'")
    return df


def fit_or_load_models() -> FittedModels:
    global _models
    if _models is not None:
        return _models
    df = load_synthetic_users()
    X = df[GENRE_KEYS].values.astype(np.float64)
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    n_clusters = min(5, max(2, len(df) // 30))
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    kmeans.fit(Xs)
    taste_labels = np.argmax(X, axis=1)
    svm = SVC(kernel="linear", probability=True, random_state=42)
    svm.fit(Xs, taste_labels)
    _models = FittedModels(scaler=scaler, kmeans=kmeans, svm=svm, synthetic=df)
    return _models


def preferences_to_vector(prefs: dict[str, Any]) -> np.ndarray:
    """Build an 8-d genre vector from stored preferences (0..1)."""
    genres = set(prefs.get("genres") or [])
    vec = np.zeros(len(GENRE_KEYS), dtype=np.float64)
    for i, key in enumerate(GENRE_KEYS):
        if key in genres:
            vec[i] = 1.0
    mood = str(prefs.get("mood") or "").lower()
    for g, w in MOOD_GENRE_BOOST.get(mood, {}).items():
        if g in GENRE_KEYS:
            vec[GENRE_KEYS.index(g)] += w
    history = (prefs.get("watch_history") or "").lower()
    hints = {
        "action": ["marvel", "batman", "mission", "fast", "john wick"],
        "comedy": ["hangover", "comedy", "funny"],
        "horror": ["conjuring", "horror", "it"],
        "romance": ["notebook", "love", "romance"],
        "sci_fi": ["matrix", "interstellar", "alien", "sci"],
        "thriller": ["gone girl", "thriller", "seven"],
        "animation": ["pixar", "animated", "anime"],
        "drama": ["godfather", "drama", "shawshank"],
    }
    for g, words in hints.items():
        if any(w in history for w in words):
            vec[GENRE_KEYS.index(g)] += 0.2
    vec = np.clip(vec, 0, None)
    if vec.sum() < 1e-6:
        vec[:] = 1.0 / len(GENRE_KEYS)
    return vec


def blend_rating_feedback(
    user_vec: np.ndarray,
    ratings_rows: list[dict[str, Any]],
    id_to_index: dict[int, int],
) -> np.ndarray:
    """Up-weight genres from titles the user rated highly; down-weight disliked genres."""
    v = user_vec.astype(np.float64).copy()
    for row in ratings_rows:
        r = float(row.get("rating") or 0)
        gids = row.get("genre_ids") or []
        if not gids:
            continue
        w = 0.12 * (r / 5.0) if r >= 3.5 else -0.08 * ((5.0 - r) / 5.0)
        for gid in gids:
            idx = id_to_index.get(int(gid))
            if idx is not None:
                v[idx] += w
    v = np.clip(v, 0, None)
    if v.sum() < 1e-6:
        v[:] = 1.0 / len(GENRE_KEYS)
    return v


def movie_genre_vector(genre_ids: list[int], id_to_index: dict[int, int]) -> np.ndarray:
    v = np.zeros(len(GENRE_KEYS), dtype=np.float64)
    for gid in genre_ids:
        idx = id_to_index.get(gid)
        if idx is not None:
            v[idx] = 1.0
    if v.sum() < 1e-6:
        v[:] = 1.0 / len(GENRE_KEYS)
    return v


def transform_user(models: FittedModels, vec: np.ndarray) -> tuple[int, int, np.ndarray]:
    """Returns (cluster_id, svm_genre_class, scaled_vector)."""
    xs = models.scaler.transform(vec.reshape(1, -1))
    cluster_id = int(models.kmeans.predict(xs)[0])
    svm_cls = int(models.svm.predict(xs)[0])
    return cluster_id, svm_cls, xs.flatten()


def cluster_neighbor_strength(models: FittedModels, cluster_id: int, movie_vec: np.ndarray) -> float:
    """Mean cosine-like overlap with synthetic users in the same cluster."""
    df = models.synthetic
    X = df[GENRE_KEYS].values.astype(np.float64)
    Xs = models.scaler.transform(X)
    labels = models.kmeans.predict(Xs)
    mask = labels == cluster_id
    if not np.any(mask):
        return 0.0
    neighbors = X[mask]
    num = (neighbors * movie_vec).sum(axis=1)
    den = np.linalg.norm(neighbors, axis=1) * (np.linalg.norm(movie_vec) + 1e-9)
    sims = num / (den + 1e-9)
    return float(np.mean(sims))


def score_movie(
    user_vec: np.ndarray,
    movie_vec: np.ndarray,
    vote_average: float,
    vote_count: int,
    models: FittedModels,
    cluster_id: int,
    svm_class: int,
) -> tuple[float, list[str]]:
    """
    Combine genre similarity, cluster affinity, SVM alignment, popularity, and user rating.
    Returns (score, explanation_strings).
    """
    explanations: list[str] = []
    # Genre cosine similarity
    uu = user_vec / (np.linalg.norm(user_vec) + 1e-9)
    mm = movie_vec / (np.linalg.norm(movie_vec) + 1e-9)
    genre_sim = float(np.dot(uu, mm))

    top_user = [GENRE_LABELS[i] for i in np.argsort(-user_vec)[:3] if user_vec[i] > 0.15]
    if genre_sim > 0.35:
        if top_user:
            explanations.append(f"Because you like {' & '.join(top_user[:2])}")

    cluster_strength = cluster_neighbor_strength(models, cluster_id, movie_vec)
    if cluster_strength > 0.25:
        explanations.append("Similar users (same taste cluster) overlap with this movie")

    # SVM: boost if movie emphasizes the predicted taste genre
    if movie_vec[svm_class] >= 0.99:
        explanations.append(f"Matches your SVM taste profile ({GENRE_LABELS[svm_class]})")

    popularity = min(1.0, (vote_average / 10.0) * np.log1p(vote_count) / 10.0)

    w_genre = 2.2
    w_cluster = 1.4
    w_svm = 0.9
    w_pop = 0.35

    svm_boost = float(movie_vec[svm_class])

    score = (
        w_genre * genre_sim
        + w_cluster * cluster_strength
        + w_svm * svm_boost
        + w_pop * popularity
    )

    if not explanations:
        explanations.append("Balanced pick based on your overall preferences")

    return score, explanations
