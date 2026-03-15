import { useState, useEffect } from "react";
import {
  Clapperboard, Sparkles, Play, Film, Music, Loader2,
  Check, CheckCircle2, Pencil, Plus, ArrowRight, HardDrive, Download,
  MessageSquare, Hash, Megaphone, RefreshCw,
} from "lucide-react";
import Card from "../components/Card";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";

export default function RenderStudio() {
  const [context, setContext] = useState(null);
  const [captions, setCaptions] = useState([]);
  const [selectedCaption, setSelectedCaption] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderResult, setRenderResult] = useState(null);
  const [captionStyle, setCaptionStyle] = useState("pov");
  const [uploadingDrive, setUploadingDrive] = useState(false);
  const [driveResult, setDriveResult] = useState(null);
  const [editIdx, setEditIdx] = useState(null);
  const [editVal, setEditVal] = useState({});

  useEffect(() => {
    const s = sessionStorage.getItem("render_context");
    if (s) setContext(JSON.parse(s));
  }, []);

  const gen = async () => {
    if (!context) return;
    setGenerating(true);
    setCaptions([]);
    setSelectedCaption(null);
    try {
      const r = await fetch("/api/captions/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song_id: context.song_id, video_id: context.video_id, style: captionStyle }),
      });
      const d = await r.json();
      setCaptions(d.captions || []);
    } catch (e) { alert("Failed: " + e.message); }
    setGenerating(false);
  };

  const render = async () => {
    if (!context || !selectedCaption) return;
    setRendering(true);
    setRenderResult(null);
    setDriveResult(null);
    try {
      const r = await fetch("/api/render", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          song_id: context.song_id, video_id: context.video_id,
          caption: selectedCaption.caption,
          keyword: selectedCaption.keyword,
          cta: selectedCaption.cta,
        }),
      });
      setRenderResult(await r.json());
    } catch (e) { setRenderResult({ status: "error", message: e.message }); }
    setRendering(false);
  };

  const uploadToDrive = async () => {
    if (!renderResult?.output_path) return;
    setUploadingDrive(true);
    try {
      const r = await fetch("/api/drive/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: renderResult.output_path, filename: renderResult.filename }),
      });
      const d = await r.json();
      setDriveResult(d);
    } catch (e) { setDriveResult({ status: "error", message: e.message }); }
    setUploadingDrive(false);
  };

  if (!context) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-800 tracking-tight">Render Studio</h1>
          <p className="text-sm text-stone-500 mt-0.5">Generate captions, replace audio, render final video</p>
        </div>
        <Card>
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-3xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
              <Clapperboard className="w-8 h-8 text-stone-300" />
            </div>
            <p className="text-stone-500 font-semibold">No video selected</p>
            <p className="text-sm text-stone-400 mt-1">Go to Song Matcher to find and select a match</p>
            <a href="/match"><Button className="mt-4" variant="secondary"><Music className="w-4 h-4" /> Go to Song Matcher</Button></a>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-extrabold text-stone-800 tracking-tight">Render Studio</h1>
        <p className="text-sm text-stone-500 mt-0.5">Generate POV captions, replace audio, render final video</p>
      </div>

      {/* Selection cards */}
      <div className="grid grid-cols-2 gap-4 animate-fade-in-up stagger-1">
        <Card hover>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-amber-500 flex items-center justify-center shadow-md shadow-primary-500/20">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider">Video</p>
              <p className="text-[13px] font-bold text-stone-800 truncate">{context.video_name}</p>
            </div>
          </div>
        </Card>
        <Card hover>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider">Song</p>
              <p className="text-[13px] font-bold text-stone-800 truncate">{context.song_name}</p>
            </div>
          </div>
          {context.score && (
            <div className="mt-2">
              <StatusBadge variant="success" dot>{(context.score * 100).toFixed(1)}% match</StatusBadge>
            </div>
          )}
        </Card>
      </div>

      {/* Step 1: POV Captions */}
      <Card className="animate-fade-in-up stagger-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-amber-500 text-white flex items-center justify-center text-xs font-bold">1</div>
            <div>
              <h2 className="text-sm font-bold text-stone-800">Generate POV Captions</h2>
              <p className="text-[11px] text-stone-400">AI generates caption + keyword + CTA for your video</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={captionStyle} onChange={(e) => setCaptionStyle(e.target.value)}
              className="px-3 py-2 rounded-xl border border-stone-200 text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 font-medium text-stone-600">
              <option value="pov">POV / Relatable</option>
              <option value="aesthetic">Aesthetic</option>
              <option value="hype">Hype / Energetic</option>
              <option value="chill">Chill Vibes</option>
              <option value="romantic">Romantic</option>
              <option value="bold">Bold & Edgy</option>
            </select>
            <Button onClick={gen} loading={generating} variant="accent" size="sm">
              <Sparkles className="w-3.5 h-3.5" /> Generate
            </Button>
          </div>
        </div>

        {generating && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-5 h-5 text-primary-500 animate-pulse" />
            </div>
            <p className="text-sm text-stone-500">Generating POV captions...</p>
          </div>
        )}

        {captions.length > 0 && (
          <div className="space-y-2">
            {captions.map((c, i) => {
              const isSelected = selectedCaption === c;
              const isEditing = editIdx === i;
              return (
                <div key={i}
                  onClick={() => { if (!isEditing) setSelectedCaption(c); }}
                  className={`px-4 py-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? "border-primary-300 bg-primary-50/50 shadow-md shadow-primary-500/10 ring-1 ring-primary-500/20"
                      : "border-stone-200/80 hover:border-stone-300 hover:bg-white hover:shadow-sm"
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <input value={editVal.caption || ""} onChange={(e) => setEditVal((p) => ({ ...p, caption: e.target.value }))}
                        placeholder="Caption..." autoFocus
                        className="w-full px-3 py-2 rounded-lg border border-primary-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                      <div className="flex gap-2">
                        <input value={editVal.keyword || ""} onChange={(e) => setEditVal((p) => ({ ...p, keyword: e.target.value }))}
                          placeholder="Keyword..." className="flex-1 px-3 py-1.5 rounded-lg border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                        <input value={editVal.cta || ""} onChange={(e) => setEditVal((p) => ({ ...p, cta: e.target.value }))}
                          placeholder="CTA..." className="flex-1 px-3 py-1.5 rounded-lg border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => {
                          const updated = [...captions];
                          updated[i] = editVal;
                          setCaptions(updated);
                          if (selectedCaption === captions[i]) setSelectedCaption(editVal);
                          setEditIdx(null);
                        }}><Check className="w-3 h-3" /> Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditIdx(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                            <p className="text-[13px] font-semibold text-stone-800">{c.caption}</p>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-stone-500">
                            <span className="flex items-center gap-1"><Hash className="w-3 h-3 text-stone-400" />{c.keyword}</span>
                            <span className="flex items-center gap-1"><Megaphone className="w-3 h-3 text-stone-400" />{c.cta}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); setEditIdx(i); setEditVal(c); }}
                            className="p-1.5 text-stone-400 hover:text-primary-500 rounded-lg hover:bg-stone-100 cursor-pointer transition">
                            <Pencil className="w-3 h-3" />
                          </button>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <button onClick={() => {
              const newCap = { caption: "pov: your caption here...", keyword: "your keyword", cta: "listen now!" };
              setCaptions((p) => [...p, newCap]);
              setEditIdx(captions.length);
              setEditVal(newCap);
            }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-stone-200 text-[12px] text-stone-500 hover:border-primary-300 hover:text-primary-600 transition w-full cursor-pointer font-medium">
              <Plus className="w-3.5 h-3.5" /> Add custom caption
            </button>

            <Button onClick={gen} variant="ghost" size="sm" className="w-full mt-1">
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate all
            </Button>
          </div>
        )}
      </Card>

      {/* Step 2: Render */}
      {selectedCaption && (
        <Card className="animate-fade-in-up stagger-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-amber-500 text-white flex items-center justify-center text-xs font-bold">2</div>
              <div>
                <h2 className="text-sm font-bold text-stone-800">Render Final Video</h2>
                <p className="text-[11px] text-stone-400">Replace audio + overlay caption on top</p>
              </div>
            </div>
            <Button onClick={render} loading={rendering} size="lg">
              <Play className="w-4 h-4" /> Render Video
            </Button>
          </div>

          {/* Preview */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 mb-4">
            <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider mb-2">Caption Preview</p>
            <div className="relative bg-stone-900 rounded-xl p-6 text-center">
              <p className="text-white text-sm font-semibold mb-1">{selectedCaption.caption}</p>
              <p className="text-stone-400 text-[10px]">{selectedCaption.keyword}</p>
              <p className="text-white/70 text-[11px] mt-3">{selectedCaption.cta}</p>
            </div>
          </div>

          {rendering && (
            <div className="text-center py-10">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-primary-200 border-t-primary-500 animate-spin" />
                <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
                  <Clapperboard className="w-6 h-6 text-primary-600" />
                </div>
              </div>
              <p className="text-sm font-semibold text-stone-700">Rendering your video...</p>
              <p className="text-[11px] text-stone-400 mt-1">Replacing audio + overlaying caption</p>
            </div>
          )}

          {renderResult?.status === "success" && (
            <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 animate-scale-in space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <Check className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-emerald-800">Video rendered!</p>
                  <p className="text-[11px] text-emerald-600">{renderResult.filename}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a href={`/api/renders/${renderResult.filename}`} download
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-emerald-200 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition cursor-pointer">
                  <Download className="w-4 h-4" /> Download
                </a>
                <Button onClick={uploadToDrive} loading={uploadingDrive} variant="secondary">
                  <HardDrive className="w-4 h-4" /> Save to Google Drive
                </Button>
              </div>

              {driveResult?.status === "uploaded" && (
                <div className="flex items-center gap-2 text-sm text-blue-600 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Saved to Drive!</span>
                  <a href={driveResult.drive_url} target="_blank" rel="noopener noreferrer"
                    className="underline hover:text-blue-700">Open in Drive</a>
                </div>
              )}
              {driveResult?.status === "error" && (
                <p className="text-sm text-red-600">{driveResult.message || driveResult.detail}</p>
              )}
            </div>
          )}

          {renderResult?.status === "error" && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200/60 text-sm text-red-700">
              Render failed: {renderResult.message || renderResult.detail}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

