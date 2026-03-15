"""
Install:
    pip install -r requirements.txt

Gemini API key:
    Put GEMINI_API_KEY in .env, or export it in your shell.

Example usage:
    python build_video_db.py --videos-dir ./videos --index-dir ./artifacts/video_index --hybrid-bpm-prefix
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np

from song_video_agent.config import AppConfig
from song_video_agent.gemini_client import GeminiClient
from song_video_agent.index_utils import create_index, save_index
from song_video_agent.video_utils import embed_video_file, scan_video_files


def build_database(videos_dir: Path, index_dir: Path, add_bpm_prefix: bool) -> None:
    config = AppConfig.from_env()
    config.video_db_dir = videos_dir
    config.index_dir = index_dir
    config.index_dir.mkdir(parents=True, exist_ok=True)
    config.temp_dir.mkdir(parents=True, exist_ok=True)

    gemini = GeminiClient(config)
    video_paths = scan_video_files(videos_dir)
    if not video_paths:
        raise FileNotFoundError(f"No video files found in {videos_dir}")

    metadata: list[dict] = []
    vectors: list[np.ndarray] = []
    total = len(video_paths)

    print(f"Found {total} video files.")
    for idx, video_path in enumerate(video_paths, start=1):
        print(f"[{idx}/{total}] Embedding {video_path.name}")
        try:
            record = embed_video_file(
                video_path,
                gemini=gemini,
                config=config,
                add_bpm_prefix=add_bpm_prefix,
            )
            vectors.append(record.pop("embedding"))
            metadata.append(record)
        except Exception as exc:
            print(f"  Skipping {video_path.name}: {exc}")

    if not vectors:
        raise RuntimeError("No video embeddings were created.")

    index = create_index(config.embedding_dimensions)
    matrix = np.vstack(vectors).astype(np.float32)
    index.add(matrix)
    save_index(index_dir, index, metadata)
    print(f"Saved FAISS index to {index_dir}")
    print(f"Indexed {len(metadata)} videos successfully.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a local FAISS video embedding database.")
    parser.add_argument("--videos-dir", default="./videos", help="Folder containing source videos.")
    parser.add_argument(
        "--index-dir",
        default="./artifacts/video_index",
        help="Folder where FAISS and metadata files will be saved.",
    )
    parser.add_argument(
        "--hybrid-bpm-prefix",
        action="store_true",
        help="Detect BPM from video audio and prefix that text during embedding.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    build_database(
        videos_dir=Path(args.videos_dir),
        index_dir=Path(args.index_dir),
        add_bpm_prefix=bool(args.hybrid_bpm_prefix),
    )

