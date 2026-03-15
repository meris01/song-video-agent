"""Song Video Agent v4 - Super RAG + FFmpeg caption rendering + caption design settings."""
from __future__ import annotations

import asyncio
import json
import os
import re
import subprocess
import sys
import uuid
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

app = FastAPI(title="Song Video Agent", version="4.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SETTINGS_FILE = PROJECT_ROOT / "webapp" / "settings.json"
UPLOAD_DIR = PROJECT_ROOT / "webapp" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_executor = ThreadPoolExecutor(max_workers=4)

# ---------------------------------------------------------------------------
# Settings helpers
# ---------------------------------------------------------------------------
def _load_settings() -> dict:
    if SETTINGS_FILE.exists():
        return json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
    return {}

def _save_settings(data: dict):
    SETTINGS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")

def _get_caption_design() -> dict:
    """Load caption design settings with defaults."""
    settings = _load_settings()
    defaults = {
        "caption_font_size": 38,
        "caption_font_color": "#FFFFFF",
        "caption_bg_color": "#000000",
        "caption_bg_opacity": 0.6,
        "caption_position": "top",
        "caption_font": "Arial",
        "caption_bold": True,
        "caption_margin_x": 40,
        "caption_margin_y": 60,
        "cta_font_size": 24,
        "cta_font_color": "#FFFFFF",
        "cta_bg_color": "#000000",
        "cta_bg_opacity": 0.5,
        "cta_position": "bottom",
        "cta_margin_y": 60,
        "keyword_show": False,
        "keyword_font_size": 18,
        "keyword_font_color": "#CCCCCC",
    }
    design = settings.get("caption_design", {})
    return {**defaults, **design}

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class SettingsPayload(BaseModel):
    supabase_url: Optional[str] = None
    supabase_service_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    twelve_labs_api_key: Optional[str] = None
    google_drive_client_id: Optional[str] = None
    google_drive_client_secret: Optional[str] = None
    google_drive_redirect_uri: Optional[str] = None
    google_drive_refresh_token: Optional[str] = None

class CaptionDesignPayload(BaseModel):
    caption_font_size: Optional[int] = None
    caption_font_color: Optional[str] = None
    caption_bg_color: Optional[str] = None
    caption_bg_opacity: Optional[float] = None
    caption_position: Optional[str] = None
    caption_font: Optional[str] = None
    caption_bold: Optional[bool] = None
    caption_margin_x: Optional[int] = None
    caption_margin_y: Optional[int] = None
    cta_font_size: Optional[int] = None
    cta_font_color: Optional[str] = None
    cta_bg_color: Optional[str] = None
    cta_bg_opacity: Optional[float] = None
    cta_position: Optional[str] = None
    cta_margin_y: Optional[int] = None
    keyword_show: Optional[bool] = None
    keyword_font_size: Optional[int] = None
    keyword_font_color: Optional[str] = None

class MatchRequest(BaseModel):
    song_id: str
    top_k: int = 5

class CaptionRequest(BaseModel):
    song_id: str
    video_id: str
    style: str = "pov"

class RenderRequest(BaseModel):
    song_id: str
    video_id: str
    caption: str
    keyword: str = ""
    cta: str = ""

class DriveUploadRequest(BaseModel):
    file_path: str
    filename: Optional[str] = None

# ---------------------------------------------------------------------------
# Service helpers
# ---------------------------------------------------------------------------
def _sanitize_pacing(val) -> str | None:
    if not val:
        return None
    v = str(val).lower().strip()
    if v in ("slow", "medium", "fast"):
        return v
    if "fast" in v or "high" in v or "quick" in v or "rapid" in v:
        return "fast"
    if "slow" in v or "low" in v or "calm" in v:
        return "slow"
    return "medium"

def _get_supabase(url: str = None, key: str = None):
    from supabase import create_client
    settings = _load_settings()
    url = url or settings.get("supabase_url", "")
    key = key or settings.get("supabase_service_key", "")
    if not url or not key:
        raise HTTPException(400, "Supabase not configured. Go to Settings first.")
    return create_client(url, key)

def _get_gemini_client():
    settings = _load_settings()
    api_key = settings.get("gemini_api_key", "")
    if not api_key:
        raise HTTPException(400, "Gemini API key not configured. Go to Settings first.")
    from google import genai
    return genai.Client(api_key=api_key)

def _get_gemini():
    settings = _load_settings()
    api_key = settings.get("gemini_api_key", "")
    if not api_key:
        raise HTTPException(400, "Gemini API key not configured. Go to Settings first.")
    from song_video_agent.config import AppConfig
    from song_video_agent.gemini_client import GeminiClient
    config = AppConfig(gemini_api_key=api_key)
    return GeminiClient(config), config

# ═══════════════════════════════════════════════════════════════════════════
# GOOGLE DRIVE INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════

def _get_drive_service():
    settings = _load_settings()
    refresh_token = settings.get("google_drive_refresh_token")
    client_id = settings.get("google_drive_client_id")
    client_secret = settings.get("google_drive_client_secret")
    if not all([refresh_token, client_id, client_secret]):
        raise HTTPException(400, "Google Drive not configured. Go to Settings.")
    import httpx
    resp = httpx.post("https://oauth2.googleapis.com/token", data={
        "client_id": client_id, "client_secret": client_secret,
        "refresh_token": refresh_token, "grant_type": "refresh_token",
    })
    if resp.status_code != 200:
        raise HTTPException(400, f"Failed to refresh Drive token: {resp.text}")
    return resp.json()["access_token"]

@app.post("/api/drive/auth-url")
def get_drive_auth_url():
    settings = _load_settings()
    client_id = settings.get("google_drive_client_id", "")
    redirect_uri = settings.get("google_drive_redirect_uri", "http://localhost:3000/settings")
    if not client_id:
        raise HTTPException(400, "Set Google Drive Client ID first.")
    scopes = "https://www.googleapis.com/auth/drive.file"
    url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&redirect_uri={redirect_uri}"
        f"&response_type=code&scope={scopes}&access_type=offline&prompt=consent"
    )
    return {"auth_url": url}

@app.post("/api/drive/exchange-code")
async def exchange_drive_code(code: str = Form(...)):
    settings = _load_settings()
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": settings.get("google_drive_client_id", ""),
            "client_secret": settings.get("google_drive_client_secret", ""),
            "redirect_uri": settings.get("google_drive_redirect_uri", "http://localhost:3000/settings"),
            "grant_type": "authorization_code",
        })
    if resp.status_code != 200:
        raise HTTPException(400, f"Token exchange failed: {resp.text}")
    tokens = resp.json()
    settings["google_drive_refresh_token"] = tokens.get("refresh_token", "")
    _save_settings(settings)
    return {"status": "connected", "message": "Google Drive connected!"}

@app.post("/api/drive/upload")
async def upload_to_drive(req: DriveUploadRequest):
    file_path = Path(req.file_path)
    if not file_path.exists():
        raise HTTPException(404, "File not found")
    access_token = _get_drive_service()
    filename = req.filename or file_path.name
    metadata = {"name": filename, "mimeType": "video/mp4"}
    settings = _load_settings()
    folder_id = settings.get("google_drive_folder_id")
    if folder_id:
        metadata["parents"] = [folder_id]
    import httpx
    async with httpx.AsyncClient(timeout=300) as client:
        init_resp = await client.post(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json; charset=UTF-8"},
            json=metadata,
        )
        upload_url = init_resp.headers.get("Location")
        if not upload_url:
            raise HTTPException(500, "No upload URL from Drive")
        file_bytes = file_path.read_bytes()
        upload_resp = await client.put(upload_url, headers={"Content-Type": "video/mp4"}, content=file_bytes)
        if upload_resp.status_code not in (200, 201):
            raise HTTPException(500, f"Drive upload failed: {upload_resp.text}")
        drive_file = upload_resp.json()
        drive_id = drive_file.get("id", "")
    return {"status": "uploaded", "drive_file_id": drive_id, "drive_url": f"https://drive.google.com/file/d/{drive_id}/view", "filename": filename}

@app.get("/api/drive/status")
def drive_status():
    settings = _load_settings()
    return {
        "connected": bool(settings.get("google_drive_refresh_token")),
        "client_configured": bool(settings.get("google_drive_client_id")),
        "folder_id": settings.get("google_drive_folder_id", ""),
    }

# ═══════════════════════════════════════════════════════════════════════════
# AI ANALYSIS ENGINE — deep understanding
# ═══════════════════════════════════════════════════════════════════════════

def _analyze_song_with_ai(client, song_path: Path, bpm: float | None) -> dict:
    from google.genai import types
    audio_bytes = song_path.read_bytes()
    mime = "audio/mpeg" if song_path.suffix.lower() == ".mp3" else "audio/wav"
    prompt = f"""You are a music-to-visual matching expert. Analyze this song deeply.

Return a JSON object:
{{
  "mood": "primary mood (happy/sad/energetic/chill/dark/romantic/epic/dreamy/aggressive/nostalgic/mysterious/playful)",
  "energy": 0.0-1.0,
  "pacing": "slow/medium/fast",
  "genre": "primary genre",
  "sub_genres": ["sub-genres"],
  "emotional_arc": "how the feel changes through the song",
  "visual_associations": ["5-8 concrete visual scenes this song evokes"],
  "color_palette": ["colors matching the vibe"],
  "ideal_video_description": "2-3 sentence description of the PERFECT video. Be very specific about setting, movement, lighting, atmosphere, camera work.",
  "tempo_feel": "bouncy/driving/swaying/pulsing/marching/flowing",
  "intensity_profile": "low-to-high/steady/building/explosive/chill-throughout/waves",
  "energy_segments": [
    {{"time": "0:00-0:30", "energy": 0.0-1.0, "description": "what happens musically"}},
    {{"time": "0:30-1:00", "energy": 0.0-1.0, "description": "what happens"}},
    {{"time": "1:00-1:30", "energy": 0.0-1.0, "description": "what happens"}}
  ],
  "negative_matches": ["types of videos that would NOT work with this song"],
  "keywords": ["15-20 keywords for semantic search"]
}}

{"BPM: " + str(int(bpm)) if bpm else "Detect BPM from audio."}
Return ONLY valid JSON."""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[prompt, types.Part.from_bytes(data=audio_bytes, mime_type=mime)],
    )
    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"): text = text[4:]
        text = text.strip()
    return json.loads(text)


def _analyze_video_with_ai(client, video_path: Path) -> dict:
    from google.genai import types
    video_bytes = video_path.read_bytes()
    prompt = """Analyze this video deeply for music matching.

Return a JSON object:
{
  "description": "3-4 sentence detailed description of visuals, action, mood, camera work",
  "mood_tags": ["moods this video conveys"],
  "energy_level": 0.0-1.0,
  "pacing": "slow/medium/fast",
  "visual_elements": ["key visual elements"],
  "color_tone": "warm/cool/neutral/vibrant/dark/pastel",
  "setting": "where the video takes place",
  "movement": "description of motion — camera movement, subject movement, editing pace",
  "ideal_song_description": "What song would be PERFECT? Describe mood, tempo, genre, energy, instruments.",
  "energy_segments": [
    {"time": "start-mid", "energy": 0.0-1.0, "description": "what's happening"},
    {"time": "mid-end", "energy": 0.0-1.0, "description": "what's happening"}
  ],
  "negative_matches": ["types of songs that would NOT work"],
  "keywords": ["15-20 keywords for matching"]
}

Return ONLY valid JSON."""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[prompt, types.Part.from_bytes(data=video_bytes, mime_type="video/mp4")],
    )
    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"): text = text[4:]
        text = text.strip()
    return json.loads(text)


def _embed_text(client, text: str) -> list[float]:
    """Embed a text description using Gemini Embedding 2 for semantic matching."""
    from google.genai import types
    response = client.models.embed_content(
        model="models/gemini-embedding-2-preview",
        contents=[types.Content(role="user", parts=[types.Part.from_text(text=text)])],
        config=types.EmbedContentConfig(output_dimensionality=3072),
    )
    return response.embeddings[0].values


def _cosine_sim(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    import numpy as np
    a, b = np.array(a, dtype=np.float32), np.array(b, dtype=np.float32)
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    return float(dot / norm) if norm > 0 else 0.0


def _ai_rerank_match(client, song_analysis: dict, video_analysis: dict, cosine_score: float) -> dict:
    prompt = f"""You are an expert music video curator. Rate how well this song matches this video. Be STRICT.

SONG:
- Mood: {song_analysis.get('mood', '?')} | Energy: {song_analysis.get('energy', '?')} | Genre: {song_analysis.get('genre', '?')}
- Pacing: {song_analysis.get('pacing', '?')} | Tempo feel: {song_analysis.get('tempo_feel', '?')}
- Ideal video: {song_analysis.get('ideal_video_description', '?')}
- Visuals it evokes: {song_analysis.get('visual_associations', [])}
- Should NOT match: {song_analysis.get('negative_matches', [])}

VIDEO:
- Description: {video_analysis.get('description', '?')}
- Mood: {video_analysis.get('mood_tags', [])} | Energy: {video_analysis.get('energy_level', '?')}
- Setting: {video_analysis.get('setting', '?')} | Movement: {video_analysis.get('movement', '?')}
- Ideal song: {video_analysis.get('ideal_song_description', '?')}
- Should NOT match: {video_analysis.get('negative_matches', [])}

Vector similarity: {cosine_score:.3f}

IMPORTANT: Check negative_matches — if the video matches a "should NOT" category, score LOW.

Return JSON:
{{"score": 0.0-1.0, "confidence": 0.0-1.0, "reason": "why", "match_highlights": ["good things"], "match_concerns": ["bad things"]}}"""

    response = client.models.generate_content(model="gemini-2.5-flash", contents=[prompt])
    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"): text = text[4:]
        text = text.strip()
    try:
        return json.loads(text)
    except:
        return {"score": cosine_score, "confidence": 0.3, "reason": "Parse failed", "match_highlights": [], "match_concerns": []}


# ═══════════════════════════════════════════════════════════════════════════
# SETTINGS ROUTES
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/settings")
def get_settings():
    settings = _load_settings()
    return {
        "supabase_url": settings.get("supabase_url", ""),
        "supabase_service_key_set": bool(settings.get("supabase_service_key")),
        "gemini_api_key_set": bool(settings.get("gemini_api_key")),
        "twelve_labs_api_key_set": bool(settings.get("twelve_labs_api_key")),
        "supabase_connected": bool(settings.get("supabase_url") and settings.get("supabase_service_key")),
        "gemini_connected": bool(settings.get("gemini_api_key")),
        "google_drive_client_id": settings.get("google_drive_client_id", ""),
        "google_drive_client_secret_set": bool(settings.get("google_drive_client_secret")),
        "google_drive_redirect_uri": settings.get("google_drive_redirect_uri", "http://localhost:3000/settings"),
        "google_drive_connected": bool(settings.get("google_drive_refresh_token")),
        "google_drive_folder_id": settings.get("google_drive_folder_id", ""),
    }

@app.post("/api/settings")
def save_settings(payload: SettingsPayload):
    settings = _load_settings()
    for key in ["supabase_url", "supabase_service_key", "gemini_api_key", "twelve_labs_api_key",
                 "google_drive_client_id", "google_drive_client_secret", "google_drive_redirect_uri",
                 "google_drive_refresh_token"]:
        val = getattr(payload, key, None)
        if val is not None and str(val).strip():
            settings[key] = str(val).strip()
    _save_settings(settings)
    return {"status": "saved"}

@app.get("/api/settings/caption-design")
def get_caption_design():
    return _get_caption_design()

@app.post("/api/settings/caption-design")
def save_caption_design(payload: CaptionDesignPayload):
    settings = _load_settings()
    design = settings.get("caption_design", {})
    for key, val in payload.model_dump(exclude_none=True).items():
        design[key] = val
    settings["caption_design"] = design
    _save_settings(settings)
    return {"status": "saved", "design": _get_caption_design()}

@app.post("/api/settings/save-drive-folder")
def save_drive_folder(folder_id: str = Form(...)):
    settings = _load_settings()
    settings["google_drive_folder_id"] = folder_id.strip()
    _save_settings(settings)
    return {"status": "saved"}

@app.post("/api/settings/test-supabase")
def test_supabase():
    try:
        sb = _get_supabase()
        try:
            sb.table("videos").select("id").limit(1).execute()
            return {"status": "connected", "message": "Connected! Schema deployed."}
        except Exception as e:
            err = str(e)
            if "relation" in err or "does not exist" in err or "42P01" in err:
                return {"status": "no_schema", "message": "Connected! Schema not deployed — click Deploy Schema."}
            return {"status": "connected", "message": f"Connected! ({err[:80]})"}
    except HTTPException:
        raise
    except Exception as e:
        return {"status": "error", "message": f"Connection failed: {str(e)[:150]}"}

@app.post("/api/settings/deploy-schema")
def deploy_schema():
    schema_file = PROJECT_ROOT / "sql" / "supabase_schema.sql"
    if not schema_file.exists():
        raise HTTPException(404, "Schema file not found")
    sql = schema_file.read_text(encoding="utf-8")
    migration = """
-- Migration: Add AI analysis columns
DO $$ BEGIN
  ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS ai_description text;
  ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS ai_analysis jsonb;
  ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS ai_analysis jsonb;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
"""
    return {"status": "manual", "message": "Copy SQL and run in Supabase SQL Editor.", "sql": sql + "\n" + migration}

# ═══════════════════════════════════════════════════════════════════════════
# VIDEO ROUTES
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/videos")
def list_videos():
    try:
        sb = _get_supabase()
        try:
            result = sb.table("videos").select(
                "id, filename, duration_seconds, bpm, mood_tags, energy_level, pacing, is_indexed, quality_passed, ai_description, ai_analysis, created_at"
            ).order("created_at", desc=True).execute()
        except:
            result = sb.table("videos").select(
                "id, filename, duration_seconds, bpm, mood_tags, energy_level, pacing, is_indexed, quality_passed, created_at"
            ).order("created_at", desc=True).execute()
        return {"videos": result.data or []}
    except HTTPException:
        raise
    except Exception as e:
        return {"videos": [], "error": str(e)}

@app.post("/api/videos/upload")
async def upload_videos(files: list[UploadFile] = File(...)):
    settings = _load_settings()
    if not settings.get("gemini_api_key"):
        raise HTTPException(400, "Gemini API key not configured.")
    results = []
    for file in files:
        try:
            suffix = Path(file.filename).suffix or ".mp4"
            temp_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{suffix}"
            content = await file.read()
            temp_path.write_bytes(content)
            results.append({"filename": file.filename, "temp_path": str(temp_path), "size_mb": round(len(content)/(1024*1024), 2), "status": "uploaded"})
        except Exception as e:
            results.append({"filename": file.filename, "status": "error", "error": str(e)})
    return {"results": results}

@app.post("/api/videos/embed")
async def embed_video(temp_path: str = Form(...), filename: str = Form(...)):
    video_path = Path(temp_path)
    if not video_path.exists():
        raise HTTPException(404, "Video file not found.")
    try:
        gemini, config = _get_gemini()
        ai_client = _get_gemini_client()
        from song_video_agent.video_utils import embed_video_file
        result = embed_video_file(video_path, gemini, config, add_bpm_prefix=True)
        try:
            ai_analysis = _analyze_video_with_ai(ai_client, video_path)
        except:
            ai_analysis = {"description": "Analysis failed", "keywords": []}
        sb = _get_supabase()
        insert_data = {
            "filename": filename, "local_path": str(video_path),
            "duration_seconds": result["duration_seconds"], "bpm": result.get("bpm"),
            "embedding": result["embedding"].tolist(), "is_indexed": True, "indexed_at": "now()",
            "mood_tags": ai_analysis.get("mood_tags", []),
            "energy_level": ai_analysis.get("energy_level"),
            "pacing": _sanitize_pacing(ai_analysis.get("pacing")),
            "ai_description": ai_analysis.get("description", ""),
            "ai_analysis": ai_analysis,
        }
        try:
            db_result = sb.table("videos").insert(insert_data).execute()
        except Exception as db_err:
            if "ai_analysis" in str(db_err) or "ai_description" in str(db_err):
                insert_data.pop("ai_analysis", None)
                insert_data.pop("ai_description", None)
                db_result = sb.table("videos").insert(insert_data).execute()
            else:
                raise
        return {"status": "success", "filename": filename, "duration_seconds": result["duration_seconds"],
                "bpm": result.get("bpm"), "chunks": result["chunk_count"],
                "video_id": db_result.data[0]["id"] if db_result.data else None, "ai_analysis": ai_analysis}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Embedding failed: {str(e)}")

@app.delete("/api/videos/{video_id}")
def delete_video(video_id: str):
    try:
        sb = _get_supabase()
        sb.table("videos").delete().eq("id", video_id).execute()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(500, str(e))

# ═══════════════════════════════════════════════════════════════════════════
# SONG UPLOAD
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/api/songs/upload")
async def upload_song(file: UploadFile = File(...)):
    try:
        suffix = Path(file.filename).suffix or ".mp3"
        temp_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{suffix}"
        content = await file.read()
        temp_path.write_bytes(content)
        gemini, config = _get_gemini()
        ai_client = _get_gemini_client()
        from song_video_agent.audio_utils import load_audio, detect_bpm, chunk_audio_bytes, bpm_prefix, audio_to_wav_bytes
        audio, sr = load_audio(temp_path, sample_rate=config.audio_sample_rate)
        bpm = detect_bpm(audio, sr)
        text_pref = bpm_prefix(bpm)
        if len(audio) / sr <= config.max_audio_seconds:
            wav = audio_to_wav_bytes(audio, sr)
            embedding = gemini.embed_bytes(wav, mime_type="audio/wav", text_prefix=text_pref)
        else:
            chunks = chunk_audio_bytes(audio, sr, config.audio_chunk_seconds, config.audio_overlap_seconds)
            embedding = gemini.embed_chunked_media(chunks, mime_type="audio/wav", text_prefix=text_pref)
        try:
            ai_analysis = _analyze_song_with_ai(ai_client, temp_path, bpm)
        except:
            ai_analysis = {"mood": "unknown", "energy": 0.5, "pacing": "medium", "keywords": [], "ideal_video_description": ""}
        sb = _get_supabase()
        insert_data = {
            "filename": file.filename, "storage_path": str(temp_path), "bpm": bpm,
            "embedding": embedding.tolist(),
            "mood": ai_analysis.get("mood"), "energy": ai_analysis.get("energy"),
            "pacing": _sanitize_pacing(ai_analysis.get("pacing")),
            "visual_keywords": ai_analysis.get("visual_associations", []),
            "emotional_tone": ai_analysis.get("emotional_arc", ""),
            "genre_tags": [g for g in ([ai_analysis.get("genre", "")] + ai_analysis.get("sub_genres", [])) if g],
            "ai_analysis": ai_analysis,
        }
        try:
            db_result = sb.table("songs").insert(insert_data).execute()
        except Exception as db_err:
            for col in ["ai_analysis", "pacing"]:
                if col in str(db_err):
                    insert_data.pop(col, None)
            db_result = sb.table("songs").insert(insert_data).execute()
        song_id = db_result.data[0]["id"] if db_result.data else None
        return {"status": "success", "song_id": song_id, "filename": file.filename, "bpm": bpm,
                "duration_seconds": round(len(audio) / sr, 1), "ai_analysis": ai_analysis}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Song upload failed: {str(e)}")

# ═══════════════════════════════════════════════════════════════════════════
# SUPER RAG MATCHING ENGINE v4
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/api/match")
def match_song_to_videos(req: MatchRequest):
    """
    Super RAG v4 pipeline:
    1. Retrieve: pgvector cosine on audio/video embeddings
    2. Semantic: embed song's ideal_video_description → cosine vs video embeddings
    3. Cross-text: embed both text descriptions → text-vs-text cosine
    4. Multi-signal: BPM, energy, mood, pacing, keywords
    5. Negative filter: check if video is in song's negative_matches
    6. Temporal: compare energy curves
    7. AI Rerank: Gemini judges top candidates
    """
    try:
        sb = _get_supabase()
        ai_client = _get_gemini_client()

        # Get song
        try:
            song_result = sb.table("songs").select(
                "embedding, bpm, mood, pacing, energy, visual_keywords, genre_tags, emotional_tone, ai_analysis"
            ).eq("id", req.song_id).execute()
        except:
            song_result = sb.table("songs").select(
                "embedding, bpm, mood, pacing, energy, visual_keywords, genre_tags, emotional_tone"
            ).eq("id", req.song_id).execute()
        if not song_result.data:
            raise HTTPException(404, "Song not found")
        song = song_result.data[0]
        song_analysis = song.get("ai_analysis") or {}

        # --- RETRIEVE: vector search ---
        retrieval_count = max(req.top_k * 4, 20)
        match_result = sb.rpc("match_videos", {
            "query_embedding": song["embedding"],
            "match_threshold": 0.15,
            "match_count": retrieval_count,
        }).execute()
        candidates = match_result.data or []
        if not candidates:
            return {"matches": [], "song_analysis": song_analysis}

        # --- SEMANTIC TEXT EMBEDDING: embed song's ideal description ---
        ideal_desc = song_analysis.get("ideal_video_description", "")
        song_text_embedding = None
        if ideal_desc:
            try:
                song_text_embedding = _embed_text(ai_client, ideal_desc)
            except:
                pass

        # Get video details
        video_ids = [c["id"] for c in candidates]
        try:
            video_details = sb.table("videos").select(
                "id, ai_analysis, ai_description, mood_tags, energy_level, pacing, bpm, embedding"
            ).in_("id", video_ids).execute()
        except:
            video_details = sb.table("videos").select(
                "id, mood_tags, energy_level, pacing, bpm"
            ).in_("id", video_ids).execute()
        video_map = {v["id"]: v for v in (video_details.data or [])}

        # --- SCORE all candidates ---
        scored = []
        for c in candidates:
            vid = video_map.get(c["id"], {})
            vid_analysis = vid.get("ai_analysis") or {}
            cosine = float(c.get("cosine_similarity", 0))

            # Basic scores
            bpm_s = _bpm_score(song.get("bpm"), c.get("bpm") or vid.get("bpm"))
            energy_s = _energy_score(song.get("energy"), vid.get("energy_level") or vid_analysis.get("energy_level"))
            mood_s = _mood_score(song.get("mood"), vid.get("mood_tags") or vid_analysis.get("mood_tags", []))
            pacing_s = _pacing_score(song.get("pacing"), vid.get("pacing") or vid_analysis.get("pacing"))
            keyword_s = _keyword_overlap(
                song_analysis.get("keywords", []) + song_analysis.get("visual_associations", []),
                vid_analysis.get("keywords", []) + vid_analysis.get("visual_elements", [])
            )

            # NEW: Semantic text embedding similarity
            text_sim = 0.5
            if song_text_embedding and vid.get("embedding"):
                try:
                    text_sim = _cosine_sim(song_text_embedding, vid["embedding"])
                    text_sim = max(0, min(1, text_sim))
                except:
                    text_sim = 0.5

            # NEW: Cross-text description embedding
            cross_text_sim = 0.5
            if ideal_desc and vid_analysis.get("description"):
                try:
                    vid_desc_emb = _embed_text(ai_client, vid_analysis["description"])
                    cross_text_sim = _cosine_sim(song_text_embedding, vid_desc_emb) if song_text_embedding else 0.5
                    cross_text_sim = max(0, min(1, cross_text_sim))
                except:
                    cross_text_sim = 0.5

            # NEW: Negative filtering
            neg_penalty = 0.0
            song_negatives = [n.lower() for n in song_analysis.get("negative_matches", [])]
            vid_negatives = [n.lower() for n in vid_analysis.get("negative_matches", [])]
            vid_desc_lower = vid_analysis.get("description", "").lower()
            song_desc_lower = song_analysis.get("ideal_video_description", "").lower()
            for neg in song_negatives:
                if neg in vid_desc_lower or any(neg in kw.lower() for kw in vid_analysis.get("keywords", [])):
                    neg_penalty += 0.15
            for neg in vid_negatives:
                if neg in song_desc_lower or song_analysis.get("genre", "").lower() in neg:
                    neg_penalty += 0.1
            neg_penalty = min(neg_penalty, 0.4)

            # NEW: Temporal energy matching
            temporal_s = _temporal_energy_match(
                song_analysis.get("energy_segments", []),
                vid_analysis.get("energy_segments", [])
            )

            # Super weighted score
            weighted = (
                0.22 * cosine +
                0.15 * text_sim +
                0.12 * cross_text_sim +
                0.10 * keyword_s +
                0.10 * energy_s +
                0.08 * mood_s +
                0.08 * temporal_s +
                0.07 * bpm_s +
                0.05 * pacing_s +
                0.03 * _description_match(ideal_desc, vid_analysis.get("description", ""))
                - neg_penalty
            )
            weighted = max(0, weighted)

            scored.append({
                **c,
                "cosine_similarity": round(cosine, 4),
                "text_similarity": round(text_sim, 4),
                "cross_text_similarity": round(cross_text_sim, 4),
                "bpm_score": round(bpm_s, 3),
                "energy_score": round(energy_s, 3),
                "mood_score": round(mood_s, 3),
                "pacing_score": round(pacing_s, 3),
                "keyword_score": round(keyword_s, 3),
                "temporal_score": round(temporal_s, 3),
                "negative_penalty": round(neg_penalty, 3),
                "weighted_score": round(weighted, 4),
                "video_analysis": vid_analysis,
            })

        scored.sort(key=lambda x: x["weighted_score"], reverse=True)

        # --- AI RERANK top candidates ---
        top_for_reranking = scored[:min(req.top_k + 3, len(scored))]
        reranked = []
        for item in top_for_reranking:
            try:
                rerank = _ai_rerank_match(ai_client, song_analysis, item.get("video_analysis", {}), item["cosine_similarity"])
                ai_score = float(rerank.get("score", 0.5))
                confidence = float(rerank.get("confidence", 0.5))
                final = 0.50 * item["weighted_score"] + 0.50 * ai_score
                reranked.append({**item, "rerank_score": round(ai_score, 3), "rerank_confidence": round(confidence, 3),
                    "rerank_reason": rerank.get("reason", ""), "match_highlights": rerank.get("match_highlights", []),
                    "match_concerns": rerank.get("match_concerns", []), "final_score": round(final, 4)})
            except:
                reranked.append({**item, "rerank_score": 0.5, "rerank_confidence": 0.0,
                    "rerank_reason": "Reranking failed", "match_highlights": [], "match_concerns": [],
                    "final_score": round(item["weighted_score"], 4)})

        reranked.sort(key=lambda x: x["final_score"], reverse=True)
        results = []
        for r in reranked[:req.top_k]:
            r.pop("video_analysis", None)
            r.pop("embedding", None)
            results.append(r)

        return {"matches": results, "song_analysis": song_analysis,
                "pipeline": "Super RAG v4 (vector + semantic text + cross-text + temporal + negative filter + AI rerank)"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Matching failed: {str(e)}")


# --- Scoring functions ---

def _bpm_score(s, v) -> float:
    if not s or not v: return 0.5
    diff = abs(float(s) - float(v))
    if diff <= 5: return 1.0
    if diff <= 15: return 0.85
    return max(0, 1 - diff / 60)

def _energy_score(s, v) -> float:
    if s is None or v is None: return 0.5
    diff = abs(float(s) - float(v))
    if diff <= 0.1: return 1.0
    if diff <= 0.25: return 0.8
    return max(0, 1 - diff * 1.5)

def _mood_score(song_mood, video_mood_tags) -> float:
    if not song_mood or not video_mood_tags: return 0.5
    sm = song_mood.lower()
    tags = [t.lower() for t in video_mood_tags]
    if sm in tags: return 1.0
    GROUPS = {
        "happy": {"playful","joyful","upbeat","cheerful","fun"},
        "sad": {"melancholic","somber","emotional","bittersweet"},
        "energetic": {"exciting","intense","powerful","dynamic","aggressive","hype"},
        "chill": {"relaxed","calm","peaceful","serene","mellow","dreamy","soothing"},
        "dark": {"mysterious","moody","ominous","tense","gritty"},
        "romantic": {"sensual","intimate","love","tender","passionate"},
        "epic": {"cinematic","grand","majestic","triumphant","inspiring"},
        "nostalgic": {"retro","vintage","wistful","sentimental"},
        "dreamy": {"ethereal","floaty","ambient","atmospheric"},
        "aggressive": {"intense","hard","raw","fierce","powerful"},
    }
    related = GROUPS.get(sm, set())
    for tag in tags:
        if tag in related: return 0.85
    return 0.3

def _pacing_score(s, v) -> float:
    if not s or not v: return 0.5
    sp, vp = s.lower(), v.lower()
    if sp == vp: return 1.0
    PM = {"slow": 0, "medium": 1, "fast": 2}
    return 0.6 if abs(PM.get(sp,1) - PM.get(vp,1)) == 1 else 0.2

def _keyword_overlap(sk_list: list, vk_list: list) -> float:
    if not sk_list or not vk_list: return 0.5
    sk = {k.lower().strip() for k in sk_list if k}
    vk = {k.lower().strip() for k in vk_list if k}
    if not sk or not vk: return 0.5
    exact = len(sk & vk)
    fuzzy = sum(0.5 for s in sk for v in vk if s != v and (s in v or v in s))
    total = exact + min(fuzzy, 5)
    return min(1.0, total / max(min(len(sk), len(vk)), 1))

def _description_match(ideal: str, actual: str) -> float:
    if not ideal or not actual: return 0.5
    STOP = {"a","an","the","is","are","with","and","or","of","in","on","to","for","that","this","it","be"}
    iw = set(ideal.lower().split()) - STOP
    aw = set(actual.lower().split()) - STOP
    if not iw: return 0.5
    return min(1.0, len(iw & aw) / max(len(iw) * 0.3, 1))

def _temporal_energy_match(song_segs: list, video_segs: list) -> float:
    """Compare energy profiles over time segments."""
    if not song_segs or not video_segs:
        return 0.5
    s_energies = [float(s.get("energy", 0.5)) for s in song_segs]
    v_energies = [float(v.get("energy", 0.5)) for v in video_segs]
    # Normalize to same length
    min_len = min(len(s_energies), len(v_energies))
    s_energies = s_energies[:min_len]
    v_energies = v_energies[:min_len]
    if not s_energies:
        return 0.5
    # Check if energy curves move in same direction
    diffs = [abs(s - v) for s, v in zip(s_energies, v_energies)]
    avg_diff = sum(diffs) / len(diffs)
    # Check direction correlation
    if len(s_energies) >= 2:
        s_dir = [s_energies[i+1] - s_energies[i] for i in range(len(s_energies)-1)]
        v_dir = [v_energies[i+1] - v_energies[i] for i in range(len(v_energies)-1)]
        same_dir = sum(1 for sd, vd in zip(s_dir, v_dir) if (sd >= 0) == (vd >= 0))
        dir_score = same_dir / len(s_dir)
    else:
        dir_score = 0.5
    return (1 - avg_diff) * 0.6 + dir_score * 0.4


# ═══════════════════════════════════════════════════════════════════════════
# POV CAPTION GENERATION
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/api/captions/generate")
def generate_captions(req: CaptionRequest):
    settings = _load_settings()
    api_key = settings.get("gemini_api_key", "")
    if not api_key:
        raise HTTPException(400, "Gemini API key not configured.")
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        sb = _get_supabase()
        try:
            song = sb.table("songs").select("filename, bpm, mood, pacing, ai_analysis").eq("id", req.song_id).execute()
        except:
            song = sb.table("songs").select("filename, bpm, mood, pacing").eq("id", req.song_id).execute()
        try:
            video = sb.table("videos").select("filename, mood_tags, energy_level, pacing, ai_analysis, ai_description").eq("id", req.video_id).execute()
        except:
            video = sb.table("videos").select("filename, mood_tags, energy_level, pacing").eq("id", req.video_id).execute()
        song_info = song.data[0] if song.data else {}
        video_info = video.data[0] if video.data else {}
        song_ai = song_info.get("ai_analysis") or {}
        video_ai = video_info.get("ai_analysis") or {}

        prompt = f"""Generate 5 POV-style caption overlays for a TikTok/Instagram music video.

SONG: Mood={song_ai.get('mood', song_info.get('mood','?'))}, Energy={song_ai.get('energy','?')}, Genre={song_ai.get('genre','?')}, Vibe={song_ai.get('emotional_arc','?')}
VIDEO: {video_ai.get('description', video_info.get('ai_description','?'))}, Setting={video_ai.get('setting','?')}, Elements={video_ai.get('visual_elements',[])}
Style: {req.style}

Return JSON array of 5 objects:
- "caption": POV/aesthetic caption with emojis (e.g. "pov: you finally found your peace 😌✨")
- "keyword": 2-3 word scene keyword (e.g. "girl driving")
- "cta": call-to-action (e.g. "listen now on Spotify!")

Rules: trendy, aesthetic, emojis, match the combined vibe. Return ONLY valid JSON array."""

        response = client.models.generate_content(model="gemini-2.5-flash", contents=[prompt])
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"): text = text[4:]
        return {"captions": json.loads(text.strip())}
    except json.JSONDecodeError:
        return {"captions": [
            {"caption": "pov: the vibes are immaculate 😌✨", "keyword": "aesthetic vibes", "cta": "save for later 🔖"},
        ]}
    except Exception as e:
        raise HTTPException(500, f"Caption generation failed: {str(e)}")

# ═══════════════════════════════════════════════════════════════════════════
# RENDER — FFmpeg based with custom caption design
# ═══════════════════════════════════════════════════════════════════════════

def _hex_to_ffmpeg_color(hex_color: str, opacity: float = 1.0) -> str:
    """Convert #RRGGBB + opacity to FFmpeg &HAABBGGRR format for ASS subtitles."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 6:
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    else:
        r, g, b = 255, 255, 255
    a = int((1 - opacity) * 255)
    return f"&H{a:02X}{b:02X}{g:02X}{r:02X}"


def _build_ass_subtitle(caption: str, keyword: str, cta: str, duration: float, width: int, height: int) -> str:
    """Build an ASS subtitle file with custom caption design."""
    design = _get_caption_design()

    # Caption styling
    cap_size = design["caption_font_size"]
    cap_color = _hex_to_ffmpeg_color(design["caption_font_color"])
    cap_bg = _hex_to_ffmpeg_color(design["caption_bg_color"], design["caption_bg_opacity"])
    cap_font = design["caption_font"]
    cap_bold = -1 if design["caption_bold"] else 0
    cap_margin_y = design["caption_margin_y"]

    # CTA styling
    cta_size = design["cta_font_size"]
    cta_color = _hex_to_ffmpeg_color(design["cta_font_color"])
    cta_bg = _hex_to_ffmpeg_color(design["cta_bg_color"], design["cta_bg_opacity"])
    cta_margin_y = design["cta_margin_y"]

    # Keyword styling
    kw_size = design["keyword_font_size"]
    kw_color = _hex_to_ffmpeg_color(design["keyword_font_color"])

    # Position alignment (ASS: 8=top-center, 2=bottom-center, 5=center)
    cap_pos = {"top": 8, "center": 5, "bottom": 2}.get(design["caption_position"], 8)
    cta_pos = {"top": 8, "center": 5, "bottom": 2}.get(design["cta_position"], 2)

    # Format duration
    def fmt(t):
        h = int(t // 3600)
        m = int((t % 3600) // 60)
        s = t % 60
        return f"{h}:{m:02d}:{s:05.2f}"

    end = fmt(duration)

    ass = f"""[Script Info]
Title: Song Video Agent Captions
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,{cap_font},{cap_size},{cap_color},&H000000FF,&H00000000,{cap_bg},{cap_bold},0,0,0,100,100,0,0,3,0,0,{cap_pos},{design['caption_margin_x']},{design['caption_margin_x']},{cap_margin_y},1
Style: CTA,{cap_font},{cta_size},{cta_color},&H000000FF,&H00000000,{cta_bg},0,0,0,0,100,100,0,0,3,0,0,{cta_pos},40,40,{cta_margin_y},1
Style: Keyword,{cap_font},{kw_size},{kw_color},&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,3,0,0,8,40,40,{cap_margin_y + cap_size + 20},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    # Add caption
    if caption:
        # Escape special ASS characters
        safe_caption = caption.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")
        ass += f"Dialogue: 0,0:00:00.00,{end},Caption,,0,0,0,,{safe_caption}\n"

    # Add keyword (if enabled)
    if keyword and design.get("keyword_show"):
        safe_kw = keyword.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")
        ass += f"Dialogue: 0,0:00:00.00,{end},Keyword,,0,0,0,,{safe_kw}\n"

    # Add CTA
    if cta:
        safe_cta = cta.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")
        ass += f"Dialogue: 0,0:00:00.00,{end},CTA,,0,0,0,,{safe_cta}\n"

    return ass


@app.post("/api/render")
def render_video(req: RenderRequest):
    try:
        sb = _get_supabase()
        video_row = sb.table("videos").select("local_path, filename").eq("id", req.video_id).execute()
        song_row = sb.table("songs").select("storage_path, filename").eq("id", req.song_id).execute()

        if not video_row.data: raise HTTPException(404, "Video not found")
        if not song_row.data: raise HTTPException(404, "Song not found")

        video_path = Path(video_row.data[0].get("local_path", ""))
        song_path = Path(song_row.data[0].get("storage_path", ""))
        if not video_path.exists(): raise HTTPException(404, f"Video file not found: {video_path}")
        if not song_path.exists(): raise HTTPException(404, f"Song file not found: {song_path}")

        # Get video dimensions and duration
        probe_cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", str(video_path)]
        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)
        probe_data = json.loads(probe_result.stdout)
        width, height, duration = 1080, 1920, 30.0
        for stream in probe_data.get("streams", []):
            if stream.get("codec_type") == "video":
                width = int(stream.get("width", 1080))
                height = int(stream.get("height", 1920))
                duration = float(stream.get("duration", 0) or probe_data.get("format", {}).get("duration", 30))
                break

        # Build ASS subtitle file
        ass_content = _build_ass_subtitle(req.caption, req.keyword, req.cta, duration, width, height)
        ass_path = UPLOAD_DIR / f"caption_{uuid.uuid4().hex[:8]}.ass"
        ass_path.write_text(ass_content, encoding="utf-8")

        # Render with FFmpeg: replace audio + burn in captions
        output_dir = UPLOAD_DIR / "rendered"
        output_dir.mkdir(exist_ok=True)
        output_path = output_dir / f"render_{uuid.uuid4().hex[:8]}.mp4"

        # FFmpeg command: video + new audio + ASS subtitles
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-i", str(song_path),
            "-filter_complex",
            f"[0:v]ass='{str(ass_path).replace(chr(92), chr(92)+chr(92)).replace(':', chr(92)+':')}'[v]",
            "-map", "[v]",
            "-map", "1:a",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            str(output_path),
        ]

        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=300)

        # If ASS filter fails (Windows path issues), try drawtext fallback
        if result.returncode != 0:
            design = _get_caption_design()
            cap_size = design["caption_font_size"]
            cta_size = design["cta_font_size"]

            # Escape text for FFmpeg drawtext
            safe_caption = req.caption.replace("'", "'\\''").replace(":", "\\:")
            safe_cta = req.cta.replace("'", "'\\''").replace(":", "\\:") if req.cta else ""

            filter_parts = []
            # Caption at top
            if req.caption:
                filter_parts.append(
                    f"drawtext=text='{safe_caption}':fontsize={cap_size}:fontcolor=white:"
                    f"x=(w-text_w)/2:y={design['caption_margin_y']}:"
                    f"borderw=2:bordercolor=black@0.7:box=1:boxcolor=black@{design['caption_bg_opacity']}:boxborderw=12"
                )
            # CTA at bottom
            if req.cta:
                filter_parts.append(
                    f"drawtext=text='{safe_cta}':fontsize={cta_size}:fontcolor=white:"
                    f"x=(w-text_w)/2:y=h-{design['cta_margin_y']+cta_size}:"
                    f"borderw=1:bordercolor=black@0.5:box=1:boxcolor=black@{design['cta_bg_opacity']}:boxborderw=8"
                )

            vf = ",".join(filter_parts) if filter_parts else "null"

            ffmpeg_cmd2 = [
                "ffmpeg", "-y",
                "-i", str(video_path),
                "-i", str(song_path),
                "-filter_complex", f"[0:v]{vf}[v]",
                "-map", "[v]", "-map", "1:a",
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-c:a", "aac", "-b:a", "192k",
                "-shortest", str(output_path),
            ]
            result2 = subprocess.run(ffmpeg_cmd2, capture_output=True, text=True, timeout=300)
            if result2.returncode != 0:
                # Last resort: just replace audio without captions
                ffmpeg_cmd3 = [
                    "ffmpeg", "-y",
                    "-i", str(video_path), "-i", str(song_path),
                    "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-shortest", str(output_path),
                ]
                result3 = subprocess.run(ffmpeg_cmd3, capture_output=True, text=True, timeout=300)
                if result3.returncode != 0:
                    raise Exception(f"FFmpeg failed: {result3.stderr[-500:]}")

        # Clean up
        ass_path.unlink(missing_ok=True)

        try:
            sb.table("rendered_ads").insert({
                "song_id": req.song_id, "video_id": req.video_id,
                "caption": req.caption, "render_status": "succeeded",
            }).execute()
        except:
            pass

        return {"status": "success", "output_path": str(output_path), "filename": output_path.name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Render failed: {str(e)}")

@app.get("/api/renders/{filename}")
def serve_render(filename: str):
    file_path = UPLOAD_DIR / "rendered" / filename
    if not file_path.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(str(file_path), media_type="video/mp4")

@app.get("/api/renders")
def list_renders():
    try:
        sb = _get_supabase()
        result = sb.table("rendered_ads").select("*").order("created_at", desc=True).execute()
        return {"renders": result.data or []}
    except Exception as e:
        return {"renders": [], "error": str(e)}

# ═══════════════════════════════════════════════════════════════════════════
# STATS + HEALTH
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/stats")
def get_stats():
    try:
        sb = _get_supabase()
        videos = sb.table("videos").select("id", count="exact").execute()
        songs = sb.table("songs").select("id", count="exact").execute()
        renders = sb.table("rendered_ads").select("id", count="exact").execute()
        indexed = sb.table("videos").select("id", count="exact").eq("is_indexed", True).execute()
        return {"total_videos": videos.count or 0, "total_songs": songs.count or 0,
                "total_renders": renders.count or 0, "indexed_videos": indexed.count or 0}
    except:
        return {"total_videos": 0, "total_songs": 0, "total_renders": 0, "indexed_videos": 0}

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "4.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
