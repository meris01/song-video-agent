# Song Video Agent

AI-powered tool that matches songs to videos, replaces audio, adds POV captions, and renders final videos.

---

## Quick Start

### Windows (VS Code Terminal)
```bash
# 1. Install (one time)
setup.bat

# 2. Run
start.bat
```

### Linux / Mac / VPS
```bash
# 1. Install (one time)
bash install.sh

# 2. Run
bash start.sh
```

App opens at **http://localhost:3000**

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.11+ | https://www.python.org/downloads/ (check "Add to PATH") |
| Node.js | 18+ | https://nodejs.org/ (LTS) |
| FFmpeg | any | Windows: https://www.gyan.dev/ffmpeg/builds/ / Linux: `sudo apt install ffmpeg` |

### API Keys Needed

| Key | Get it at | Required |
|-----|-----------|----------|
| Gemini API Key | https://aistudio.google.com/apikey | Yes |
| Supabase URL + Service Key | https://supabase.com (free project) | Yes |
| Google Drive OAuth | https://console.cloud.google.com | Optional |

---

## VPS Deployment (Ubuntu)

```bash
# Install system deps
sudo apt update && sudo apt install -y python3 python3-pip ffmpeg nodejs npm

# Clone repo
git clone https://github.com/meris01/song-video-agent.git
cd song-video-agent

# Install
bash install.sh

# Run (background)
nohup bash start.sh > app.log 2>&1 &

# Or with screen
screen -S songvideo
bash start.sh
# Ctrl+A, D to detach
```

Access at `http://YOUR_VPS_IP:3000`

---

## First Time Setup (In the App)

1. **Settings** → Add Supabase URL + Service Key + Gemini API Key → Save
2. **Settings** → Test Connection → Deploy Schema (copy SQL → run in Supabase SQL Editor)
3. **Video Library** → Upload videos → Click "Embed All with AI"
4. **Song Matcher** → Upload song → RAG Match → Select best match
5. **Render Studio** → Generate captions → Select one → Render Video → Download

---

## Caption Design

In **Settings** → **Caption Design**:
- Font, size, color, background, opacity
- Position (top / center / bottom)
- CTA styling (separate)
- Live preview
- Applied to ALL future renders

---

## Google Drive Setup (Optional)

1. Go to https://console.cloud.google.com
2. Create project → Enable "Google Drive API"
3. Credentials → OAuth Client ID → Web application
4. Add redirect URI: `http://localhost:3000/settings`
5. Copy Client ID + Secret → paste in Settings
6. Click "Get Authorization URL" → Authorize → Paste code → Connect

---

## File Structure
```
song-video-agent/
├── setup.bat / install.sh   ← Install deps
├── start.bat / start.sh     ← Start the app
├── stop.bat                 ← Stop (Windows)
├── webapp/
│   ├── backend/main.py      ← FastAPI server
│   └── frontend/src/        ← React UI
├── sql/supabase_schema.sql  ← Database schema
└── song_video_agent/        ← Core AI engine
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Python/Node not found | Install and add to PATH |
| Port 3000/8000 in use | Kill other processes using those ports |
| Captions not on video | Install FFmpeg |
| No matching videos | Upload more videos first |
| Supabase error | Check URL/key, run Deploy Schema |
