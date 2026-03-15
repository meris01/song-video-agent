from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Optional

import numpy as np
from google import genai
from google.genai import types

from song_video_agent.config import AppConfig
from song_video_agent.index_utils import average_embeddings, normalize_embedding


class GeminiClient:
    def __init__(self, config: AppConfig) -> None:
        self.config = config
        self.client = genai.Client(api_key=config.gemini_api_key)

    def embed_bytes(
        self,
        payload: bytes,
        mime_type: str,
        text_prefix: str = "",
    ) -> np.ndarray:
        parts = []
        if text_prefix.strip():
            parts.append(types.Part.from_text(text=text_prefix.strip()))
        parts.append(types.Part.from_bytes(data=payload, mime_type=mime_type))
        content = types.Content(role="user", parts=parts)
        response = self.client.models.embed_content(
            model=self.config.embedding_model,
            contents=[content],
            config=types.EmbedContentConfig(
                output_dimensionality=self.config.embedding_dimensions
            ),
        )
        embedding = np.asarray(response.embeddings[0].values, dtype=np.float32)
        return normalize_embedding(embedding)

    def embed_chunked_media(
        self,
        chunks: list[bytes],
        mime_type: str,
        text_prefix: str = "",
    ) -> np.ndarray:
        vectors = [self.embed_bytes(chunk, mime_type=mime_type, text_prefix=text_prefix) for chunk in chunks]
        return average_embeddings(vectors)

    def rerank_with_flash(
        self,
        song_description: str,
        video_path: Path,
    ) -> tuple[Optional[float], str]:
        prompt = (
            "You are reranking a music-to-video match.\n"
            "Score how well this video works as background visuals for the song description.\n"
            "Return strict JSON with keys score and reason.\n"
            "score must be a float from 0 to 1.\n"
            f"Song description: {song_description}"
        )
        payload = video_path.read_bytes()
        mime_type = "video/mp4"
        response = self.client.models.generate_content(
            model=self.config.rerank_model,
            contents=[
                prompt,
                types.Part.from_bytes(data=payload, mime_type=mime_type),
            ],
        )
        text = response.text or ""
        try:
            data = json.loads(text)
            return float(data["score"]), str(data.get("reason", "")).strip()
        except Exception:
            match = re.search(r"([01](?:\.\d+)?)", text)
            score = float(match.group(1)) if match else None
            return score, text.strip()

