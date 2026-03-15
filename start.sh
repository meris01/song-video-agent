#!/bin/bash
# Song Video Agent - Start both servers
set -e

echo "============================================"
echo "  Song Video Agent - Starting..."
echo "============================================"

# Kill any existing processes
pkill -f "uvicorn.*main:app" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# Start backend
echo "Starting backend on :8000..."
cd "$(dirname "$0")/webapp/backend"
python3 -c "import uvicorn; uvicorn.run('main:app', host='0.0.0.0', port=8000)" &
BACKEND_PID=$!
cd ../..

sleep 2

# Start frontend
echo "Starting frontend on :3000..."
cd "$(dirname "$0")/webapp/frontend"
npx vite --host &
FRONTEND_PID=$!
cd ../..

sleep 3

echo ""
echo "============================================"
echo "  ✅ Song Video Agent is running!"
echo "============================================"
echo ""
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:8000"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

# Wait and handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'; exit 0" SIGINT SIGTERM
wait
