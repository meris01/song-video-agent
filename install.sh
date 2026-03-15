#!/bin/bash
# Song Video Agent - One command install (Linux/Mac/VPS)
set -e

echo "============================================"
echo "  Song Video Agent - Installing..."
echo "============================================"

# Check dependencies
command -v python3 >/dev/null 2>&1 || { echo "❌ Python3 not found. Install: sudo apt install python3 python3-pip python3-venv"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found. Install: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install nodejs"; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { echo "⚠️  FFmpeg not found. Install: sudo apt install ffmpeg"; }

echo "✅ Dependencies found"

# Python deps
echo ""
echo "--- Installing Python packages ---"
pip3 install -r webapp/backend/requirements.txt --quiet
echo "✅ Python packages installed"

# Frontend deps
echo ""
echo "--- Installing frontend packages ---"
cd webapp/frontend
npm install --silent
cd ../..
echo "✅ Frontend packages installed"

echo ""
echo "============================================"
echo "  ✅ Installation complete!"
echo "============================================"
echo ""
echo "  Run:  bash start.sh"
echo "  Open: http://localhost:3000"
echo ""
