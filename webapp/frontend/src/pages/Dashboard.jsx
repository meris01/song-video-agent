import { useState, useEffect } from "react";
import { Film, Music, Clapperboard, Database, ArrowRight, Sparkles, Zap, Brain } from "lucide-react";
import Card from "../components/Card";

const STATS = [
  { key: "total_videos", label: "Videos", icon: Film, gradient: "from-primary-500 to-amber-500", shadow: "shadow-primary-500/20" },
  { key: "indexed_videos", label: "Indexed", icon: Database, gradient: "from-emerald-500 to-teal-500", shadow: "shadow-emerald-500/20" },
  { key: "total_songs", label: "Songs", icon: Music, gradient: "from-violet-500 to-purple-500", shadow: "shadow-violet-500/20" },
  { key: "total_renders", label: "Renders", icon: Clapperboard, gradient: "from-rose-500 to-pink-500", shadow: "shadow-rose-500/20" },
];

const STEPS = [
  { num: 1, title: "Connect Supabase", desc: "Add your project URL and service key", link: "/settings", icon: Database },
  { num: 2, title: "Upload Videos", desc: "AI analyzes and embeds each video automatically", link: "/videos", icon: Film },
  { num: 3, title: "Match a Song", desc: "RAG engine finds the perfect video matches", link: "/match", icon: Music },
  { num: 4, title: "Render Video", desc: "Replace audio, add POV caption, export MP4", link: "/render", icon: Clapperboard },
];

const PIPELINE = [
  { label: "Upload", sub: "Video/Song" },
  { label: "AI Analyze", sub: "Gemini 2.5" },
  { label: "Embed", sub: "3072-dim" },
  { label: "Vector Search", sub: "pgvector" },
  { label: "Score", sub: "Multi-signal" },
  { label: "AI Rerank", sub: "Gemini Judge" },
  { label: "Render", sub: "FFmpeg" },
];

export default function Dashboard() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-[28px] font-extrabold text-stone-800 tracking-tight">
            Song Video Agent
          </h1>
          <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-primary-500 to-amber-500 text-[10px] font-bold text-white uppercase tracking-wider">
            RAG v2
          </span>
        </div>
        <p className="text-sm text-stone-500 max-w-xl">
          AI-powered song-to-video matching. Upload videos, match songs, generate POV captions, and render final videos.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(({ key, label, icon: Icon, gradient, shadow }, i) => (
          <div key={key} className={`animate-fade-in-up stagger-${i + 1}`}>
            <Card hover>
              <div className="flex items-center gap-3.5">
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg ${shadow}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[22px] font-extrabold text-stone-800 leading-none">
                    {loading ? <span className="inline-block w-8 h-5 animate-shimmer rounded" /> : (stats[key] ?? 0)}
                  </p>
                  <p className="text-[11px] text-stone-500 font-medium mt-0.5">{label}</p>
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <Card className="animate-fade-in-up stagger-3">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4.5 h-4.5 text-primary-600" />
          <h2 className="text-sm font-bold text-stone-800">RAG Matching Pipeline</h2>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {PIPELINE.map((step, i) => (
            <div key={i} className="flex items-center gap-1.5 shrink-0">
              <div className="px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200/80 text-center min-w-[90px]">
                <p className="text-[11px] font-bold text-stone-700">{step.label}</p>
                <p className="text-[9px] text-stone-400 font-medium mt-0.5">{step.sub}</p>
              </div>
              {i < PIPELINE.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-stone-300 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Get started */}
      <div className="animate-fade-in-up stagger-4">
        <h2 className="text-sm font-bold text-stone-800 mb-3">Get Started</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {STEPS.map((step, i) => (
            <a key={step.num} href={step.link} className="block group">
              <Card hover className={`animate-fade-in-up stagger-${i + 1}`}>
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-md shadow-primary-500/20 group-hover:shadow-lg group-hover:shadow-primary-500/30 transition-shadow">
                    {step.num}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[13px] font-semibold text-stone-800">{step.title}</h3>
                      <ArrowRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
