# Song Video Agent

## Pip Install
```bash
pip install -r requirements.txt
```

## Gemini API Key
1. Go to Google AI Studio: https://aistudio.google.com/app/apikey
2. Create an API key
3. Put it in `.env` as `GEMINI_API_KEY=...`

## What This App Does
- Embeds local videos with Gemini Embedding 2 preview
- Stores vectors in a local FAISS cosine index
- Lets you upload an MP3/WAV song in Streamlit
- Finds the top matching videos from your local database
- Optionally boosts with BPM text and reranks with Gemini 2.5 Flash

## Main Files
- `build_video_db.py`: precompute video embeddings into FAISS
- `app.py`: Streamlit UI for song upload and matching

## Quick Start
```bash
python build_video_db.py --videos-dir ./videos --index-dir ./artifacts/video_index --hybrid-bpm-prefix
streamlit run app.py
```

## How Matching Works
- Songs longer than 80 seconds are split into overlapping WAV chunks
- Videos longer than 120 seconds are split into overlapping MP4 chunks
- Every chunk is embedded with `models/gemini-embedding-2-preview`
- Chunk embeddings are averaged into one normalized vector
- FAISS `IndexFlatIP` is used after `faiss.normalize_L2` so inner product behaves like cosine similarity

## Notes
- Keep your source videos inside `./videos/`
- First build the database before launching the app
- The current build is local-first; Supabase docs and schema notes are included for the next step

