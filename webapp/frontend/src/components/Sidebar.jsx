import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Film,
  Music,
  Sparkles,
  Settings,
  Clapperboard,
  Zap,
} from "lucide-react";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/videos", icon: Film, label: "Video Library" },
  { to: "/match", icon: Music, label: "Song Matcher" },
  { to: "/render", icon: Clapperboard, label: "Render Studio" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[256px] glass border-r border-stone-200/70 flex flex-col z-30">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-stone-800 leading-tight tracking-tight">
              Song Video
            </h1>
            <p className="text-[10px] font-semibold text-primary-500 tracking-widest uppercase">
              AI Agent
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 group ${
                isActive
                  ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/25"
                  : "text-stone-500 hover:bg-stone-100/80 hover:text-stone-700"
              }`
            }
          >
            <Icon className="w-[17px] h-[17px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-stone-100">
        <div className="px-3 py-3 rounded-xl bg-primary-50/60 border border-primary-100/50">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-3.5 h-3.5 text-primary-500" />
            <p className="text-[11px] font-semibold text-primary-700">RAG Engine v2</p>
          </div>
          <p className="text-[10px] text-stone-500 leading-relaxed">
            Gemini Embedding + AI Reranking + pgvector
          </p>
        </div>
      </div>
    </aside>
  );
}
