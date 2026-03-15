from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv


load_dotenv()


@dataclass(slots=True)
class AppConfig:
    gemini_api_key: str
    embedding_model: str = os.getenv(
        "GEMINI_EMBEDDING_MODEL", "models/gemini-embedding-2-preview"
    )
    rerank_model: str = os.getenv("GEMINI_RERANK_MODEL", "gemini-2.5-flash")
    video_db_dir: Path = Path(os.getenv("VIDEO_DB_DIR", "./videos"))
    index_dir: Path = Path(os.getenv("INDEX_DIR", "./artifacts/video_index"))
    temp_dir: Path = Path(os.getenv("TEMP_DIR", "./artifacts/tmp"))
    top_k_default: int = int(os.getenv("TOP_K_DEFAULT", "5"))
    embedding_dimensions: int = 3072
    max_audio_seconds: int = 80
    max_video_seconds: int = 120
    audio_chunk_seconds: int = 70
    audio_overlap_seconds: int = 20
    video_chunk_seconds: int = 100
    video_overlap_seconds: int = 20
    audio_sample_rate: int = 16000

    @classmethod
    def from_env(cls, streamlit_secrets: Optional[object] = None) -> "AppConfig":
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not api_key and streamlit_secrets is not None:
            api_key = str(streamlit_secrets.get("GEMINI_API_KEY", "")).strip()

        if not api_key:
            raise RuntimeError(
                "Missing GEMINI_API_KEY. Put it in .env or in Streamlit secrets."
            )

        cfg = cls(gemini_api_key=api_key)
        cfg.index_dir.mkdir(parents=True, exist_ok=True)
        cfg.temp_dir.mkdir(parents=True, exist_ok=True)
        cfg.video_db_dir.mkdir(parents=True, exist_ok=True)
        return cfg

