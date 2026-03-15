import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Music, Upload, Search, Film, Clock, Music2, CheckCircle2,
  ArrowRight, Loader2, Brain, Sparkles, TrendingUp, Eye,
  ThumbsUp, AlertTriangle, Gauge, Tag, Palette,
} from "lucide-react";
import Card from "../components/Card";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";

export default function SongMatcher() {
  const [song, setSong] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matches, setMatches] = useState([]);
  const [songAnalysis, setSongAnalysis] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [pipeline, setPipeline] = useState("");

  const onDrop = useCallback(async (files) => {
    if (!files.length) return;
    setUploading(true);
    setSong(null);
    setMatches([]);
    setSelectedMatch(null);
    setSongAnalysis(null);

    const fd = new FormData();
    fd.append("file", files[0]);
    try {
      const r = await fetch("/api/songs/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (d.status === "success") { setSong(d); setSongAnalysis(d.ai_analysis); }
      else alert(d.detail || "Upload failed");
    } catch (e) { alert("Upload failed: " + e.message); }
    setUploading(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"] }, multiple: false,
  });

  const findMatches = async () => {
    if (!song?.song_id) return;
    setMatching(true);
    setMatches([]);
    try {
      const r = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song_id: song.song_id, top_k: 5 }),
      });
      const d = await r.json();
      setMatches(d.matches || []);
      setSongAnalysis(d.song_analysis || songAnalysis);
      setPipeline(d.pipeline || "");
    } catch (e) { alert("Matching failed: " + e.message); }
    setMatching(false);
  };

  const selectVideo = (match) => {
    setSelectedMatch(match);
    sessionStorage.setItem("render_context", JSON.stringify({
      song_id: song.song_id, song_name: song.filename,
      video_id: match.id, video_name: match.filename,
      score: match.final_score,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-extrabold text-stone-800 tracking-tight">Song Matcher</h1>
        <p className="text-sm text-stone-500 mt-0.5">Upload a song — RAG engine finds the best matching videos</p>
      </div>

      {/* Step 1: Upload */}
      <Card className="animate-fade-in-up stagger-1">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-amber-500 text-white flex items-center justify-center text-xs font-bold">1</div>
          <h2 className="text-sm font-bold text-stone-800">Upload Song</h2>
        </div>

        {song ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <Music className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-stone-800">{song.filename}</p>
                  <p className="text-[11px] text-stone-500">{song.duration_seconds}s{song.bpm ? ` · ${Math.round(song.bpm)} BPM` : ""}</p>
                </div>
              </div>
              <StatusBadge variant="success" dot>AI Analyzed</StatusBadge>
            </div>

            {songAnalysis && (
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 animate-fade-in space-y-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary-500" />
                  <p className="text-xs font-bold text-stone-700">AI Song Analysis</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {songAnalysis.mood && <MiniStat label="Mood" value={songAnalysis.mood} />}
                  {songAnalysis.energy != null && <MiniStat label="Energy" value={`${(songAnalysis.energy * 100).toFixed(0)}%`} />}
                  {songAnalysis.genre && <MiniStat label="Genre" value={songAnalysis.genre} />}
                  {songAnalysis.pacing && <MiniStat label="Pacing" value={songAnalysis.pacing} />}
                </div>
                {songAnalysis.ideal_video_description && (
                  <div className="px-3 py-2.5 rounded-lg bg-primary-50/50 border border-primary-100/60">
                    <p className="text-[9px] text-primary-500 font-bold mb-0.5">Ideal Video</p>
                    <p className="text-[11px] text-stone-600 leading-relaxed">{songAnalysis.ideal_video_description}</p>
                  </div>
                )}
                {songAnalysis.visual_associations?.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Eye className="w-3 h-3 text-stone-400" />
                    {songAnalysis.visual_associations.map((v, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-white border border-stone-200/60 text-stone-600 rounded-full">{v}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
            isDragActive ? "border-primary-400 bg-primary-50/50 scale-[1.01]" : "border-stone-200 hover:border-primary-300"
          }`}>
            <input {...getInputProps()} />
            {uploading ? (
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mb-3">
                  <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                </div>
                <p className="text-sm font-semibold text-stone-700">Analyzing song with AI...</p>
                <p className="text-xs text-stone-400 mt-1">Embedding + mood/energy/genre detection</p>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-stone-100 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-stone-400" />
                </div>
                <p className="text-sm font-semibold text-stone-700">Drop a song here or click to browse</p>
                <p className="text-xs text-stone-400 mt-1">MP3, WAV, M4A, OGG, FLAC, AAC</p>
              </>
            )}
          </div>
        )}
      </Card>

      {/* Step 2: Match */}
      {song && (
        <Card className="animate-fade-in-up stagger-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-amber-500 text-white flex items-center justify-center text-xs font-bold">2</div>
              <h2 className="text-sm font-bold text-stone-800">Find Best Matches</h2>
            </div>
            <Button onClick={findMatches} loading={matching} variant="accent">
              <Search className="w-4 h-4" /> RAG Match
            </Button>
          </div>

          {matching && (
            <div className="text-center py-10">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-primary-200 border-t-primary-500 animate-spin" />
                <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
                  <Brain className="w-6 h-6 text-primary-600" />
                </div>
              </div>
              <p className="text-sm font-semibold text-stone-700">RAG matching in progress...</p>
              <div className="flex items-center justify-center gap-2 mt-2 text-[11px] text-stone-400">
                <span>Vector retrieval</span>
                <ArrowRight className="w-3 h-3" />
                <span>Semantic scoring</span>
                <ArrowRight className="w-3 h-3" />
                <span>AI reranking</span>
              </div>
            </div>
          )}

          {matches.length > 0 && (
            <div className="space-y-3">
              {pipeline && (
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-3 h-3 text-primary-500" />
                  <p className="text-[10px] text-primary-600 font-semibold">{pipeline}</p>
                </div>
              )}

              {matches.map((m, i) => (
                <div key={m.id} onClick={() => selectVideo(m)} className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 animate-fade-in-up stagger-${i + 1} ${
                  selectedMatch?.id === m.id
                    ? "border-primary-300 bg-primary-50/50 shadow-md shadow-primary-500/10 ring-1 ring-primary-500/20"
                    : "border-stone-200/80 hover:border-stone-300 hover:bg-white hover:shadow-sm"
                }`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold shrink-0 shadow-md ${
                      i === 0 ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-500/25"
                      : i === 1 ? "bg-gradient-to-br from-stone-300 to-stone-400 text-white shadow-stone-400/25"
                      : "bg-gradient-to-br from-primary-500 to-amber-500 text-white shadow-primary-500/25"
                    }`}>#{i + 1}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Film className="w-4 h-4 text-stone-400" />
                        <p className="text-[13px] font-bold text-stone-800 truncate">{m.filename}</p>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-stone-500 mb-3">
                        {m.duration_seconds && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{Math.round(m.duration_seconds)}s</span>}
                        {m.bpm && <span className="flex items-center gap-1"><Music2 className="w-3 h-3" />{Math.round(m.bpm)} BPM</span>}
                      </div>

                      <div className="grid grid-cols-4 gap-x-3 gap-y-1.5">
                        <ScoreBar value={m.cosine_similarity} label="Vector" />
                        <ScoreBar value={m.keyword_score} label="Keywords" />
                        <ScoreBar value={m.energy_score} label="Energy" />
                        <ScoreBar value={m.mood_score} label="Mood" />
                        <ScoreBar value={m.bpm_score} label="BPM" />
                        <ScoreBar value={m.pacing_score} label="Pacing" />
                        <ScoreBar value={m.description_score} label="Desc" />
                        <ScoreBar value={m.rerank_score} label="AI Judge" />
                      </div>

                      {m.rerank_reason && (
                        <p className="text-[11px] text-stone-500 mt-2.5 italic leading-relaxed">"{m.rerank_reason}"</p>
                      )}

                      <div className="flex items-start gap-4 mt-2">
                        {m.match_highlights?.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <ThumbsUp className="w-3 h-3 text-emerald-500 shrink-0" />
                            {m.match_highlights.slice(0, 3).map((h, j) => (
                              <span key={j} className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">{h}</span>
                            ))}
                          </div>
                        )}
                        {m.match_concerns?.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                            {m.match_concerns.slice(0, 2).map((c, j) => (
                              <span key={j} className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100">{c}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-amber-500">
                        {(m.final_score * 100).toFixed(1)}%
                      </div>
                      <p className="text-[9px] text-stone-400 font-medium">final score</p>
                      <div className="mt-1 text-[10px] text-stone-400">
                        <span className="text-primary-500 font-semibold">{(m.weighted_score * 100).toFixed(0)}%</span> weighted
                        <br />
                        <span className="text-amber-500 font-semibold">{(m.rerank_score * 100).toFixed(0)}%</span> AI rerank
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedMatch && (
            <div className="mt-4 flex justify-end animate-fade-in">
              <a href="/render">
                <Button size="lg"><Sparkles className="w-4 h-4" /> Continue to Render <ArrowRight className="w-4 h-4" /></Button>
              </a>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-white border border-stone-200/60">
      <p className="text-[9px] text-stone-400 font-medium">{label}</p>
      <p className="text-[12px] font-bold text-stone-700 capitalize">{value}</p>
    </div>
  );
}

function ScoreBar({ value, label }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-stone-400 font-medium">{label}</span>
        <span className="text-[9px] font-bold text-stone-600">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="w-full bg-stone-100 rounded-full h-1">
        <div className="bg-gradient-to-r from-primary-500 to-amber-500 h-1 rounded-full transition-all duration-700"
          style={{ width: `${Math.min(value * 100, 100)}%` }} />
      </div>
    </div>
  );
}
