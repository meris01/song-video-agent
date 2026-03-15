import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload, Film, Trash2, Clock, Music2, CheckCircle2, Loader2,
  CloudUpload, Zap, Brain, Eye, Tag, Gauge,
} from "lucide-react";
import Card from "../components/Card";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";

export default function VideoLibrary() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [embedding, setEmbedding] = useState({});
  const [expanded, setExpanded] = useState(null);

  const fetchVideos = () => {
    fetch("/api/videos")
      .then((r) => r.json())
      .then((d) => { setVideos(d.videos || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchVideos(); }, []);

  const onDrop = useCallback(async (files) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    try {
      const r = await fetch("/api/videos/upload", { method: "POST", body: fd });
      const d = await r.json();
      setUploadQueue(d.results || []);
    } catch (e) { alert("Upload failed: " + e.message); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "video/*": [".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v"] }, multiple: true,
  });

  const embedVideo = async (item) => {
    setEmbedding((p) => ({ ...p, [item.filename]: true }));
    try {
      const fd = new FormData();
      fd.append("temp_path", item.temp_path);
      fd.append("filename", item.filename);
      const r = await fetch("/api/videos/embed", { method: "POST", body: fd });
      const d = await r.json();
      if (d.status === "success") {
        setUploadQueue((prev) => prev.map((u) =>
          u.filename === item.filename ? { ...u, status: "embedded", ...d } : u));
        fetchVideos();
      } else { throw new Error(d.detail || "Failed"); }
    } catch (e) {
      setUploadQueue((prev) => prev.map((u) =>
        u.filename === item.filename ? { ...u, status: "error", error: e.message } : u));
    }
    setEmbedding((p) => ({ ...p, [item.filename]: false }));
  };

  const embedAll = async () => {
    for (const item of uploadQueue.filter((u) => u.status === "uploaded")) {
      await embedVideo(item);
    }
  };

  const deleteVideo = async (id) => {
    if (!confirm("Delete this video?")) return;
    try { await fetch(`/api/videos/${id}`, { method: "DELETE" }); setVideos((p) => p.filter((v) => v.id !== id)); }
    catch (e) { alert("Delete failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-800 tracking-tight">Video Library</h1>
          <p className="text-sm text-stone-500 mt-0.5">Upload, analyze with AI, and embed into vector database</p>
        </div>
        <StatusBadge variant="accent" dot>{videos.length} video{videos.length !== 1 && "s"} indexed</StatusBadge>
      </div>

      {/* Upload */}
      <Card className="animate-fade-in-up stagger-1">
        <div {...getRootProps()} className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
          isDragActive ? "border-primary-400 bg-primary-50/50 scale-[1.01]" : "border-stone-200 hover:border-primary-300 hover:bg-white"
        }`}>
          <input {...getInputProps()} />
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-colors ${
            isDragActive ? "bg-primary-100" : "bg-stone-100"}`}>
            <CloudUpload className={`w-7 h-7 ${isDragActive ? "text-primary-500" : "text-stone-400"}`} />
          </div>
          <p className="text-sm font-semibold text-stone-700">
            {isDragActive ? "Drop videos here..." : "Drag & drop videos, or click to browse"}
          </p>
          <p className="text-xs text-stone-400 mt-1">MP4, MOV, WebM, AVI, MKV — AI analysis runs automatically</p>
        </div>
      </Card>

      {/* Queue */}
      {uploadQueue.length > 0 && (
        <Card className="animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary-600" />
              <h2 className="text-sm font-bold text-stone-800">Processing Queue</h2>
            </div>
            <Button size="sm" onClick={embedAll} disabled={!uploadQueue.some((u) => u.status === "uploaded")}>
              <Zap className="w-3.5 h-3.5" /> Embed All with AI
            </Button>
          </div>
          <div className="space-y-2">
            {uploadQueue.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-stone-50 border border-stone-200/80">
                <div className="flex items-center gap-3">
                  <Film className="w-4 h-4 text-stone-400" />
                  <div>
                    <p className="text-[13px] font-medium text-stone-700">{item.filename}</p>
                    <p className="text-[11px] text-stone-400">{item.size_mb} MB{item.bpm ? ` · ${Math.round(item.bpm)} BPM` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.status === "uploaded" && (
                    <Button size="sm" variant="secondary" onClick={() => embedVideo(item)} loading={embedding[item.filename]}>
                      <Brain className="w-3 h-3" /> Embed
                    </Button>
                  )}
                  {item.status === "embedded" && (
                    <StatusBadge variant="success"><CheckCircle2 className="w-3 h-3" /> AI Analyzed</StatusBadge>
                  )}
                  {item.status === "error" && <StatusBadge variant="error">{item.error?.slice(0, 40)}</StatusBadge>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 animate-shimmer rounded-2xl" />)}
        </div>
      ) : videos.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-3xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
              <Film className="w-8 h-8 text-stone-300" />
            </div>
            <p className="text-stone-500 font-semibold">No videos yet</p>
            <p className="text-sm text-stone-400 mt-1">Upload videos above to build your library</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((v, i) => {
            const ai = v.ai_analysis || {};
            const isExpanded = expanded === v.id;
            return (
              <Card key={v.id} hover className={`group animate-fade-in-up stagger-${(i % 5) + 1} cursor-pointer`} onClick={() => setExpanded(isExpanded ? null : v.id)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-amber-500 flex items-center justify-center shrink-0">
                      <Film className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-[13px] font-semibold text-stone-800 truncate">{v.filename}</h3>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteVideo(v.id); }}
                    className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-500 transition-all cursor-pointer p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-stone-500 mb-3">
                  {v.duration_seconds && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{Math.round(v.duration_seconds)}s</span>}
                  {v.bpm && <span className="flex items-center gap-1"><Music2 className="w-3 h-3" />{Math.round(v.bpm)} BPM</span>}
                  {v.energy_level && <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />{Math.round(v.energy_level * 100)}%</span>}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {v.is_indexed && <StatusBadge variant="success" dot>Indexed</StatusBadge>}
                  {v.pacing && <StatusBadge variant="neutral">{v.pacing}</StatusBadge>}
                  {(v.mood_tags || []).slice(0, 2).map((t) => <StatusBadge key={t} variant="info">{t}</StatusBadge>)}
                </div>

                {v.ai_description && (
                  <p className="text-[11px] text-stone-500 leading-relaxed line-clamp-2">{v.ai_description}</p>
                )}

                {isExpanded && ai.visual_elements && (
                  <div className="mt-3 pt-3 border-t border-stone-100 animate-fade-in space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Eye className="w-3 h-3 text-stone-400" />
                      {ai.visual_elements.slice(0, 5).map((v, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full">{v}</span>
                      ))}
                    </div>
                    {ai.ideal_song_description && (
                      <p className="text-[10px] text-primary-600 italic">Best with: {ai.ideal_song_description}</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
