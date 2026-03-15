# Song Video Agent

AI-powered tool that automatically matches songs to video clips, replaces the audio, adds stylish quote captions, and renders a final video ready to post.

---

## What It Does

1. Upload your video clips to the library
2. Upload a song — AI finds the best matching video
3. Swaps the audio, generates aesthetic quote captions
4. Renders a final video you can download

---

## Install in 3 Steps

### Step 1: Install These First (if you don't have them)

| What | Download Link |
|------|--------------|
| **Python 3.11+** | https://www.python.org/downloads/ |
| **Node.js 18+** | https://nodejs.org/ (click LTS) |
| **FFmpeg** | Windows: https://www.gyan.dev/ffmpeg/builds/ — Mac: `brew install ffmpeg` — Linux: `sudo apt install ffmpeg` |

> **Windows users:** When installing Python, CHECK the box that says **"Add Python to PATH"**

### Step 2: Download & Install

```bash
git clone https://github.com/meris01/song-video-agent.git
cd song-video-agent
```

**Windows (double-click or run in terminal):**
```
setup.bat
```

**Mac / Linux / VPS:**
```bash
bash install.sh
```

### Step 3: Run It

**Windows:**
```
start.bat
```

**Mac / Linux / VPS:**
```bash
bash start.sh
```

Your browser opens to **http://localhost:3000** — that's the app!

---

## First Time in the App

1. Go to **Settings** page
2. Add your **Gemini API Key** ([get one free here](https://aistudio.google.com/apikey))
3. Add your **Supabase URL + Service Key** ([create free project here](https://supabase.com))
4. Click **Save** then **Deploy Schema**
5. Go to **Video Library** → upload some video clips
6. Go to **Song Matcher** → upload a song → it finds the best video match
7. Go to **Render Studio** → generate captions → render → download your video

---

## Stop the App

**Windows:**
```
stop.bat
```

**Mac / Linux:**
```
Press Ctrl+C in the terminal
```

---

## Run on a VPS (Ubuntu Server)

```bash
# Install system requirements
sudo apt update && sudo apt install -y python3 python3-pip python3-venv ffmpeg nodejs npm

# Download and install
git clone https://github.com/meris01/song-video-agent.git
cd song-video-agent
bash install.sh

# Run in background (keeps running after you close terminal)
nohup bash start.sh > app.log 2>&1 &
```

Open in browser: `http://YOUR_SERVER_IP:3000`

---

## Folder Structure

```
song-video-agent/
├── setup.bat / install.sh    ← Install (run once)
├── start.bat / start.sh      ← Start the app
├── stop.bat                   ← Stop the app (Windows)
├── webapp/
│   ├── backend/main.py        ← API server
│   └── frontend/src/          ← Web interface
├── sql/supabase_schema.sql    ← Database setup
└── docs/                      ← Full documentation
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `python not found` | Install Python and check "Add to PATH" |
| `node not found` | Install Node.js from https://nodejs.org |
| Port 3000 already in use | Close other apps using that port, or restart your computer |
| Videos not rendering | Install FFmpeg and add to PATH |
| Supabase error | Double-check your URL and Service Key in Settings |
| Nothing happens on `start.bat` | Right-click → Run as Administrator |

---

## Need Help?

- Full setup details: see [CLIENT_GUIDE.md](CLIENT_GUIDE.md)
- Architecture docs: see [docs/](docs/) folder
- Report issues: https://github.com/meris01/song-video-agent/issues

