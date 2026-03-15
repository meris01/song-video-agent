"""
Install:
    pip install -r requirements.txt

Gemini API key:
    Put GEMINI_API_KEY in .env, or set it in Streamlit secrets.

Run:
    streamlit run app.py
"""

from __future__ import annotations

import mimetypes
import tempfile
from pathlib import Path

import numpy as np
import streamlit as st

from song_video_agent.audio_utils import bpm_prefix, chunk_audio_bytes, detect_bpm, load_audio
from song_video_agent.config import AppConfig
from song_video_agent.gemini_client import GeminiClient
from song_video_agent.index_utils import load_index, search_index


def embed_uploaded_song(
    audio_bytes: bytes,
    filename: str,
    gemini: GeminiClient,
    config: AppConfig,
    add_bpm_prefix: bool,
) -> tuple[np.ndarray, float | None]:
    suffix = Path(filename).suffix or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_audio:
        temp_path = Path(temp_audio.name)
        temp_audio.write(audio_bytes)

    try:
        audio, sample_rate = load_audio(temp_path, sample_rate=config.audio_sample_rate)
    finally:
        temp_path.unlink(missing_ok=True)

    bpm = detect_bpm(audio, sample_rate)
    text_prefix = bpm_prefix(bpm) if add_bpm_prefix else ""
    duration_seconds = len(audio) / sample_rate
    mime_type = mimetypes.guess_type(filename)[0] or "audio/wav"

    if duration_seconds <= config.max_audio_seconds:
        vector = gemini.embed_bytes(audio_bytes, mime_type=mime_type, text_prefix=text_prefix)
    else:
        chunks = chunk_audio_bytes(
            audio=audio,
            sample_rate=sample_rate,
            chunk_seconds=config.audio_chunk_seconds,
            overlap_seconds=config.audio_overlap_seconds,
        )
        vector = gemini.embed_chunked_media(chunks, mime_type="audio/wav", text_prefix=text_prefix)
    return vector, bpm


def build_song_description(filename: str, bpm: float | None, user_notes: str) -> str:
    parts = [f"Song file: {filename}."]
    if bpm:
        parts.append(f"Detected BPM is around {int(round(bpm))}.")
    if user_notes.strip():
        parts.append(f"User notes: {user_notes.strip()}")
    parts.append("Judge whether the visuals work well as a background or edit clip for this song.")
    return " ".join(parts)


def maybe_rerank_results(
    results: list[dict],
    gemini: GeminiClient,
    song_description: str,
) -> list[dict]:
    reranked: list[dict] = []
    for item in results:
        score, reason = gemini.rerank_with_flash(song_description, Path(item["path"]))
        updated = dict(item)
        if score is not None:
            updated["rerank_score"] = float(max(0.0, min(1.0, score)))
        if reason:
            updated["rerank_reason"] = reason
        reranked.append(updated)
    reranked.sort(
        key=lambda row: (
            row.get("rerank_score", row["score_0_to_1"]),
            row["score_0_to_1"],
        ),
        reverse=True,
    )
    return reranked


def main() -> None:
    st.set_page_config(page_title="Song Video Matcher", layout="wide")
    st.title("Song to Video Matcher")
    st.caption(
        "Upload a song, embed it with Gemini, and find the best matching videos from your local FAISS database."
    )

    try:
        config = AppConfig.from_env(getattr(st, "secrets", None))
        gemini = GeminiClient(config)
        index, metadata = load_index(config.index_dir)
    except Exception as exc:
        st.error(f"Startup error: {exc}")
        st.stop()

    with st.sidebar:
        st.header("Search Options")
        top_k = st.slider("Top K results", min_value=1, max_value=10, value=config.top_k_default)
        add_bpm_prefix = st.checkbox("Boost with BPM text prefix", value=True)
        use_rerank = st.checkbox("Rerank top results with Gemini 2.5 Flash", value=False)
        rerank_count = st.slider("Rerank first N matches", min_value=3, max_value=20, value=10)
        user_notes = st.text_area("Optional song notes", placeholder="moody, fast, cinematic, romantic...")

    uploaded_file = st.file_uploader("Upload song (MP3 or WAV)", type=["mp3", "wav"])
    if not uploaded_file:
        st.info("Upload a song to start matching.")
        return

    audio_bytes = uploaded_file.getvalue()
    if not audio_bytes:
        st.error("Uploaded file is empty.")
        return

    try:
        with st.status("Embedding song and searching videos...", expanded=True) as status:
            status.write("Analyzing BPM and chunking audio if needed.")
            vector, bpm = embed_uploaded_song(
                audio_bytes=audio_bytes,
                filename=uploaded_file.name,
                gemini=gemini,
                config=config,
                add_bpm_prefix=add_bpm_prefix,
            )

            status.write("Searching FAISS cosine similarity index.")
            results = search_index(index, metadata, vector, top_k=max(top_k, rerank_count))

            if use_rerank and results:
                status.write("Reranking top candidates with Gemini 2.5 Flash.")
                song_description = build_song_description(uploaded_file.name, bpm, user_notes)
                reranked_subset = maybe_rerank_results(results[:rerank_count], gemini, song_description)
                remainder = results[rerank_count:]
                results = reranked_subset + remainder

            results = results[:top_k]
            status.update(label="Search complete.", state="complete")
    except Exception as exc:
        st.error(f"Search failed: {exc}")
        return

    if bpm:
        st.success(f"Detected BPM: {int(round(bpm))}")
    else:
        st.warning("BPM could not be detected reliably for this upload.")

    if not results:
        st.warning("No matches found.")
        return

    export_rows = []
    st.subheader("Matches")
    for rank, item in enumerate(results, start=1):
        export_rows.append(
            {
                "rank": rank,
                "filename": item["filename"],
                "score_0_to_1": item["score_0_to_1"],
                "raw_score": item["raw_score"],
                "path": item["path"],
            }
        )

        st.markdown(
            f"### {rank}. {item['filename']}\n"
            f"Similarity: `{item['score_0_to_1']:.3f}`  |  "
            f"Raw cosine: `{item['raw_score']:.3f}`  |  "
            f"Duration: `{item.get('duration_seconds', 0):.1f}s`"
        )
        if item.get("bpm"):
            st.caption(f"Indexed video BPM: {int(round(item['bpm']))}")
        if item.get("rerank_reason"):
            st.caption(f"Rerank note: {item['rerank_reason']}")
        st.video(item["path"])

    st.download_button(
        "Export result list as CSV",
        data="\n".join(
            ["rank,filename,score_0_to_1,raw_score,path"]
            + [
                f"{row['rank']},{row['filename']},{row['score_0_to_1']:.6f},{row['raw_score']:.6f},{row['path']}"
                for row in export_rows
            ]
        ),
        file_name="song_video_matches.csv",
        mime="text/csv",
    )


if __name__ == "__main__":
    main()
