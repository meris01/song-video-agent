from __future__ import annotations

import pickle
from pathlib import Path
from typing import Iterable, List, Sequence

import faiss
import numpy as np


INDEX_FILE = "video_index.faiss"
METADATA_FILE = "video_metadata.pkl"


def normalize_embedding(vector: np.ndarray) -> np.ndarray:
    data = np.asarray(vector, dtype=np.float32).reshape(1, -1)
    faiss.normalize_L2(data)
    return data[0]


def average_embeddings(vectors: Sequence[np.ndarray]) -> np.ndarray:
    if not vectors:
        raise ValueError("Cannot average zero embeddings.")
    stacked = np.vstack(vectors).astype(np.float32)
    mean_vector = np.mean(stacked, axis=0)
    return normalize_embedding(mean_vector)


def create_index(dimension: int) -> faiss.IndexFlatIP:
    return faiss.IndexFlatIP(dimension)


def save_index(index_dir: Path, index: faiss.IndexFlatIP, metadata: list[dict]) -> None:
    index_dir.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(index_dir / INDEX_FILE))
    with open(index_dir / METADATA_FILE, "wb") as fh:
        pickle.dump(metadata, fh)


def load_index(index_dir: Path) -> tuple[faiss.Index, list[dict]]:
    index_path = index_dir / INDEX_FILE
    metadata_path = index_dir / METADATA_FILE
    if not index_path.exists() or not metadata_path.exists():
        raise FileNotFoundError(
            f"Missing index files in {index_dir}. Run build_video_db.py first."
        )
    index = faiss.read_index(str(index_path))
    with open(metadata_path, "rb") as fh:
        metadata = pickle.load(fh)
    return index, metadata


def search_index(
    index: faiss.Index,
    metadata: list[dict],
    query_vector: np.ndarray,
    top_k: int,
) -> list[dict]:
    query = np.asarray(query_vector, dtype=np.float32).reshape(1, -1)
    faiss.normalize_L2(query)
    scores, indices = index.search(query, top_k)
    results: list[dict] = []
    for score, idx in zip(scores[0], indices[0], strict=False):
        if idx < 0 or idx >= len(metadata):
            continue
        item = dict(metadata[idx])
        item["raw_score"] = float(score)
        item["score_0_to_1"] = float(max(0.0, min(1.0, (score + 1.0) / 2.0)))
        results.append(item)
    return results

