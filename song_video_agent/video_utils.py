from __future__ import annotations

import mimetypes
import tempfile
from pathlib import Path
from typing import Iterable, List, Optional

import numpy as np
from moviepy import VideoFileClip

from song_video_agent.audio_utils import bpm_prefix, chunk_audio_bytes, detect_bpm, load_audio
from song_video_agent.config import AppConfig
from song_video_agent.gemini_client import GeminiClient
from song_video_agent.index_utils import average_embeddings


VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"}


def scan_video_files(video_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in video_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS
    )


def get_video_duration(video_path: Path) -> float:
    with VideoFileClip(str(video_path)) as clip:
        return float(clip.duration)


def _subclip(clip: VideoFileClip, start: float, end: float) -> VideoFileClip:
    if hasattr(clip, "subclipped"):
        return clip.subclipped(start, end)
    return clip.subclip(start, end)


def chunk_video_paths(
    video_path: Path,
    temp_dir: Path,
    chunk_seconds: int,
    overlap_seconds: int,
) -> list[Path]:
    temp_dir.mkdir(parents=True, exist_ok=True)
    output_paths: list[Path] = []
    with VideoFileClip(str(video_path)) as clip:
        duration = float(clip.duration)
        if duration <= chunk_seconds:
            return [video_path]

        step = max(chunk_seconds - overlap_seconds, 1)
        start = 0.0
        counter = 0
        while start < duration:
            end = min(start + chunk_seconds, duration)
            chunk = _subclip(clip, start, end)
            output_path = temp_dir / f"{video_path.stem}_chunk_{counter:03d}.mp4"
            chunk.write_videofile(
                str(output_path),
                codec="libx264",
                audio_codec="aac",
                logger=None,
            )
            chunk.close()
            output_paths.append(output_path)
            if end >= duration:
                break
            start += step
            counter += 1
    return output_paths


def detect_video_bpm(video_path: Path, sample_rate: int = 16000) -> Optional[float]:
    with VideoFileClip(str(video_path)) as clip:
        if clip.audio is None:
            return None
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_audio:
            temp_path = Path(temp_audio.name)
        try:
            clip.audio.write_audiofile(
                str(temp_path),
                fps=sample_rate,
                nbytes=2,
                codec="pcm_s16le",
                logger=None,
            )
            audio, sr = load_audio(temp_path, sample_rate=sample_rate)
            return detect_bpm(audio, sr)
        finally:
            temp_path.unlink(missing_ok=True)


def embed_video_file(
    video_path: Path,
    gemini: GeminiClient,
    config: AppConfig,
    add_bpm_prefix: bool = False,
) -> dict:
    duration = get_video_duration(video_path)
    bpm = detect_video_bpm(video_path, sample_rate=config.audio_sample_rate) if add_bpm_prefix else None
    text_prefix = bpm_prefix(bpm)
    mime_type = mimetypes.guess_type(video_path.name)[0] or "video/mp4"

    if duration <= config.max_video_seconds:
        vector = gemini.embed_bytes(video_path.read_bytes(), mime_type=mime_type, text_prefix=text_prefix)
        chunk_count = 1
    else:
        chunk_paths = chunk_video_paths(
            video_path,
            temp_dir=config.temp_dir / video_path.stem,
            chunk_seconds=config.video_chunk_seconds,
            overlap_seconds=config.video_overlap_seconds,
        )
        chunk_vectors = []
        for chunk_path in chunk_paths:
            chunk_vectors.append(
                gemini.embed_bytes(
                    chunk_path.read_bytes(),
                    mime_type="video/mp4",
                    text_prefix=text_prefix,
                )
            )
            if chunk_path != video_path:
                chunk_path.unlink(missing_ok=True)
        vector = average_embeddings(chunk_vectors)
        chunk_count = len(chunk_vectors)

    return {
        "path": str(video_path.resolve()),
        "filename": video_path.name,
        "duration_seconds": duration,
        "bpm": bpm,
        "chunk_count": chunk_count,
        "embedding": vector,
    }

