from __future__ import annotations

import io
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

import librosa
import numpy as np
import soundfile as sf


def load_audio(
    source: str | Path | bytes,
    sample_rate: int = 16000,
) -> Tuple[np.ndarray, int]:
    if isinstance(source, (str, Path)):
        audio, sr = librosa.load(str(source), sr=sample_rate, mono=True)
        return audio.astype(np.float32), sr

    with sf.SoundFile(io.BytesIO(source)) as snd:
        audio = snd.read(dtype="float32", always_2d=False)
        sr = snd.samplerate
    if getattr(audio, "ndim", 1) > 1:
        audio = np.mean(audio, axis=1)
    if sr != sample_rate:
        audio = librosa.resample(audio, orig_sr=sr, target_sr=sample_rate)
        sr = sample_rate
    return audio.astype(np.float32), sr


def detect_bpm(audio: np.ndarray, sample_rate: int) -> Optional[float]:
    if audio.size == 0:
        return None
    tempo, _ = librosa.beat.beat_track(y=audio, sr=sample_rate)
    if np.isscalar(tempo):
        bpm = float(tempo)
    else:
        bpm = float(tempo[0])
    return bpm if bpm > 0 else None


def bpm_prefix(bpm: Optional[float]) -> str:
    if not bpm:
        return ""
    return f"BPM around {int(round(bpm))}, rhythmic feel aligned to this tempo. "


def chunk_audio_bytes(
    audio: np.ndarray,
    sample_rate: int,
    chunk_seconds: int,
    overlap_seconds: int,
) -> List[bytes]:
    if audio.size == 0:
        return []

    chunk_samples = chunk_seconds * sample_rate
    overlap_samples = overlap_seconds * sample_rate
    step = max(chunk_samples - overlap_samples, 1)

    chunks: List[bytes] = []
    start = 0
    total = len(audio)
    while start < total:
        end = min(start + chunk_samples, total)
        chunks.append(audio_to_wav_bytes(audio[start:end], sample_rate))
        if end >= total:
            break
        start += step
    return chunks


def audio_to_wav_bytes(audio: np.ndarray, sample_rate: int) -> bytes:
    buffer = io.BytesIO()
    sf.write(buffer, audio, sample_rate, format="WAV")
    return buffer.getvalue()

