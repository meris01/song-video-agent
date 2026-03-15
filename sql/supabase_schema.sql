-- Song Video Agent - Full Supabase Schema
-- Run this in the Supabase SQL Editor

-- Enable pgvector extension
create extension if not exists vector;

-- ============================================================
-- VIDEOS TABLE
-- Stores all ingested video clips with their embeddings
-- ============================================================
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  source_url text,
  drive_file_id text,
  drive_url text,
  local_path text,
  duration_seconds numeric,
  bpm numeric,
  mood_tags text[] default '{}',
  energy_level numeric,
  pacing text check (pacing in ('slow', 'medium', 'fast')),
  embedding vector(3072),
  is_indexed boolean default false,
  quality_passed boolean default true,
  quality_notes text,
  sheet_row_index integer,
  created_at timestamptz not null default now(),
  indexed_at timestamptz,
  updated_at timestamptz default now()
);

-- ============================================================
-- SONGS TABLE
-- Stores uploaded/analyzed songs with embeddings
-- ============================================================
create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  filename text,
  track_name text,
  artist text,
  spotify_track_id text,
  spotify_url text,
  preview_url text,
  storage_path text,
  bpm numeric,
  energy numeric,
  danceability numeric,
  valence numeric,
  acousticness numeric,
  instrumentalness numeric,
  mood text,
  pacing text check (pacing in ('slow', 'medium', 'fast')),
  genre_tags text[] default '{}',
  lyric_themes text[] default '{}',
  visual_keywords text[] default '{}',
  emotional_tone text,
  embedding vector(3072),
  analysis_json jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CAMPAIGNS TABLE
-- Tracks campaign requests from Google Sheets
-- ============================================================
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  spotify_url text not null,
  input_type text check (input_type in ('track', 'playlist')) default 'track',
  target_countries text[] default '{}',
  ads_needed integer default 1,
  status text default 'new' check (status in ('new', 'processing', 'analyzed', 'matched', 'rendering', 'completed', 'failed')),
  error_message text,
  sheet_row_index integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz default now()
);

-- ============================================================
-- MATCHES TABLE
-- Stores song-to-video match results with detailed scores
-- ============================================================
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  song_id uuid references public.songs(id) on delete cascade,
  video_id uuid references public.videos(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  rank integer,
  cosine_similarity numeric,
  bpm_score numeric,
  energy_score numeric,
  mood_score numeric,
  pacing_score numeric,
  weighted_score numeric not null,
  rerank_score numeric,
  final_score numeric not null,
  match_reason text,
  is_selected boolean default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- RENDERED_ADS TABLE
-- Stores final rendered ad video results
-- ============================================================
create table if not exists public.rendered_ads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  song_id uuid references public.songs(id) on delete set null,
  video_id uuid references public.videos(id) on delete set null,
  target_country text,
  caption text,
  creatomate_render_id text,
  render_status text default 'pending' check (render_status in ('pending', 'rendering', 'succeeded', 'failed')),
  output_drive_file_id text,
  output_drive_url text,
  created_at timestamptz not null default now(),
  rendered_at timestamptz
);

-- ============================================================
-- PROCESSING LOGS TABLE
-- Stores errors and events for debugging
-- ============================================================
create table if not exists public.processing_logs (
  id uuid primary key default gen_random_uuid(),
  stage text not null,
  entity_type text,
  entity_id uuid,
  campaign_id uuid references public.campaigns(id) on delete set null,
  level text default 'info' check (level in ('info', 'warn', 'error')),
  message text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- pgvector cosine similarity index for video embeddings
create index if not exists videos_embedding_cosine_idx
  on public.videos
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- pgvector index for song embeddings
create index if not exists songs_embedding_cosine_idx
  on public.songs
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- Lookup indexes
create index if not exists videos_is_indexed_idx on public.videos (is_indexed) where is_indexed = true;
create index if not exists videos_quality_passed_idx on public.videos (quality_passed) where quality_passed = true;
create index if not exists campaigns_status_idx on public.campaigns (status);
create index if not exists matches_campaign_idx on public.matches (campaign_id);
create index if not exists matches_song_idx on public.matches (song_id);
create index if not exists rendered_ads_campaign_idx on public.rendered_ads (campaign_id);
create index if not exists processing_logs_campaign_idx on public.processing_logs (campaign_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function: Search videos by embedding similarity
create or replace function match_videos(
  query_embedding vector(3072),
  match_threshold float default 0.5,
  match_count int default 15
)
returns table (
  id uuid,
  filename text,
  drive_file_id text,
  drive_url text,
  duration_seconds numeric,
  bpm numeric,
  mood_tags text[],
  energy_level numeric,
  pacing text,
  cosine_similarity float
)
language sql stable
as $$
  select
    v.id,
    v.filename,
    v.drive_file_id,
    v.drive_url,
    v.duration_seconds,
    v.bpm,
    v.mood_tags,
    v.energy_level,
    v.pacing,
    1 - (v.embedding <=> query_embedding) as cosine_similarity
  from videos v
  where v.is_indexed = true
    and v.quality_passed = true
    and 1 - (v.embedding <=> query_embedding) > match_threshold
  order by v.embedding <=> query_embedding
  limit match_count;
$$;

-- Function: Update timestamps automatically
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create or replace trigger videos_updated_at
  before update on public.videos
  for each row execute function update_updated_at();

create or replace trigger campaigns_updated_at
  before update on public.campaigns
  for each row execute function update_updated_at();

-- ============================================================
-- NOTES
-- ============================================================
-- IVFFlat index requires at least 100 rows to be effective.
-- For small collections (< 100 videos), the index still works but
-- consider using exact search (no index) for better accuracy.
--
-- To rebuild the index after bulk inserts:
--   REINDEX INDEX videos_embedding_cosine_idx;
--
-- Vector dimension is 3072 (Gemini Embedding 2 full resolution).
