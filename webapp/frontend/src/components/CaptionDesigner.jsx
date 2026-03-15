import { useState, useEffect } from "react";
import {
  Type, Palette, Move, Check, RotateCcw,
  AlignCenter, Bold, Eye, EyeOff,
} from "lucide-react";
import Card from "./Card";
import Button from "./Button";

const FONTS = ["Arial", "Helvetica", "Impact", "Georgia", "Verdana", "Tahoma", "Trebuchet MS", "Courier New"];
const POSITIONS = [
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "bottom", label: "Bottom" },
];

export default function CaptionDesigner() {
  const [design, setDesign] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/caption-design")
      .then((r) => r.json())
      .then(setDesign)
      .catch(() => {});
  }, []);

  const update = (key, val) => setDesign((p) => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings/caption-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(design),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert("Failed: " + e.message);
    }
    setSaving(false);
  };

  const reset = () => {
    setDesign({
      caption_font_size: 38, caption_font_color: "#FFFFFF", caption_bg_color: "#000000",
      caption_bg_opacity: 0.6, caption_position: "top", caption_font: "Arial",
      caption_bold: true, caption_margin_x: 40, caption_margin_y: 60,
      cta_font_size: 24, cta_font_color: "#FFFFFF", cta_bg_color: "#000000",
      cta_bg_opacity: 0.5, cta_position: "bottom", cta_margin_y: 60,
      keyword_show: false, keyword_font_size: 18, keyword_font_color: "#CCCCCC",
    });
  };

  if (!design) return null;

  return (
    <Card>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
          <Type className="w-5 h-5 text-purple-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-stone-800">Caption Design</h2>
          <p className="text-xs text-stone-500">Customize how captions appear on all rendered videos</p>
        </div>
      </div>

      {/* Live Preview */}
      <div className="mb-6 rounded-xl overflow-hidden border border-stone-200/80">
        <div className="relative bg-gradient-to-b from-stone-700 to-stone-900 aspect-[9/16] max-h-[320px] flex flex-col justify-between p-4">
          {/* Caption preview */}
          <div style={{
            marginTop: design.caption_position === "top" ? "0" : design.caption_position === "center" ? "auto" : "auto",
            marginBottom: design.caption_position === "bottom" ? "0" : design.caption_position === "center" ? "auto" : undefined,
            textAlign: "center",
          }}>
            {design.caption_position === "top" && (
              <div style={{
                display: "inline-block",
                fontSize: `${Math.min(design.caption_font_size * 0.55, 24)}px`,
                color: design.caption_font_color,
                backgroundColor: `${design.caption_bg_color}${Math.round(design.caption_bg_opacity * 255).toString(16).padStart(2, '0')}`,
                fontWeight: design.caption_bold ? "bold" : "normal",
                fontFamily: design.caption_font,
                padding: "6px 14px",
                borderRadius: "8px",
                maxWidth: "90%",
              }}>
                pov: the vibes are immaculate 😌✨
              </div>
            )}
          </div>

          <div className="text-center text-stone-500 text-[10px]">
            video preview area
          </div>

          {/* Caption at center */}
          {design.caption_position === "center" && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div style={{
                display: "inline-block",
                fontSize: `${Math.min(design.caption_font_size * 0.55, 24)}px`,
                color: design.caption_font_color,
                backgroundColor: `${design.caption_bg_color}${Math.round(design.caption_bg_opacity * 255).toString(16).padStart(2, '0')}`,
                fontWeight: design.caption_bold ? "bold" : "normal",
                fontFamily: design.caption_font,
                padding: "6px 14px",
                borderRadius: "8px",
                textAlign: "center",
              }}>
                pov: the vibes are immaculate 😌✨
              </div>
            </div>
          )}

          {/* Bottom section */}
          <div className="text-center space-y-2">
            {design.caption_position === "bottom" && (
              <div style={{
                display: "inline-block",
                fontSize: `${Math.min(design.caption_font_size * 0.55, 24)}px`,
                color: design.caption_font_color,
                backgroundColor: `${design.caption_bg_color}${Math.round(design.caption_bg_opacity * 255).toString(16).padStart(2, '0')}`,
                fontWeight: design.caption_bold ? "bold" : "normal",
                fontFamily: design.caption_font,
                padding: "6px 14px",
                borderRadius: "8px",
              }}>
                pov: the vibes are immaculate 😌✨
              </div>
            )}
            <div style={{
              display: "inline-block",
              fontSize: `${Math.min(design.cta_font_size * 0.55, 16)}px`,
              color: design.cta_font_color,
              backgroundColor: `${design.cta_bg_color}${Math.round(design.cta_bg_opacity * 255).toString(16).padStart(2, '0')}`,
              padding: "4px 10px",
              borderRadius: "6px",
            }}>
              listen now on Spotify! 🎵
            </div>
          </div>
        </div>
      </div>

      {/* Caption Settings */}
      <div className="space-y-5">
        <SectionHeader icon={Type} title="Caption Text" />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Font" value={design.caption_font} options={FONTS.map(f => ({ value: f, label: f }))}
            onChange={(v) => update("caption_font", v)} />
          <RangeField label="Font Size" value={design.caption_font_size} min={16} max={72}
            onChange={(v) => update("caption_font_size", v)} />
          <ColorField label="Text Color" value={design.caption_font_color}
            onChange={(v) => update("caption_font_color", v)} />
          <ColorField label="Background" value={design.caption_bg_color}
            onChange={(v) => update("caption_bg_color", v)} />
          <RangeField label="BG Opacity" value={design.caption_bg_opacity} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => update("caption_bg_opacity", v)} />
          <SelectField label="Position" value={design.caption_position} options={POSITIONS}
            onChange={(v) => update("caption_position", v)} />
          <RangeField label="Margin X" value={design.caption_margin_x} min={0} max={200}
            onChange={(v) => update("caption_margin_x", v)} />
          <RangeField label="Margin Y" value={design.caption_margin_y} min={0} max={300}
            onChange={(v) => update("caption_margin_y", v)} />
        </div>
        <ToggleField label="Bold" checked={design.caption_bold} onChange={(v) => update("caption_bold", v)} />

        <SectionHeader icon={Palette} title="CTA (Call-to-Action)" />
        <div className="grid grid-cols-2 gap-3">
          <RangeField label="Font Size" value={design.cta_font_size} min={12} max={48}
            onChange={(v) => update("cta_font_size", v)} />
          <ColorField label="Text Color" value={design.cta_font_color}
            onChange={(v) => update("cta_font_color", v)} />
          <ColorField label="Background" value={design.cta_bg_color}
            onChange={(v) => update("cta_bg_color", v)} />
          <RangeField label="BG Opacity" value={design.cta_bg_opacity} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => update("cta_bg_opacity", v)} />
          <SelectField label="Position" value={design.cta_position} options={POSITIONS}
            onChange={(v) => update("cta_position", v)} />
          <RangeField label="Margin Y" value={design.cta_margin_y} min={0} max={300}
            onChange={(v) => update("cta_margin_y", v)} />
        </div>

        <SectionHeader icon={Eye} title="Keyword" />
        <ToggleField label="Show keyword on video" checked={design.keyword_show} onChange={(v) => update("keyword_show", v)} />
        {design.keyword_show && (
          <div className="grid grid-cols-2 gap-3">
            <RangeField label="Font Size" value={design.keyword_font_size} min={10} max={36}
              onChange={(v) => update("keyword_font_size", v)} />
            <ColorField label="Color" value={design.keyword_font_color}
              onChange={(v) => update("keyword_font_color", v)} />
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 mt-6">
        <Button onClick={save} loading={saving}>
          <Check className="w-4 h-4" /> Save Caption Design
        </Button>
        <Button onClick={reset} variant="ghost">
          <RotateCcw className="w-4 h-4" /> Reset
        </Button>
        {saved && (
          <span className="text-sm text-emerald-600 flex items-center gap-1.5 animate-fade-in">
            <Check className="w-4 h-4" /> Saved!
          </span>
        )}
      </div>
    </Card>
  );
}

/* ─── Sub-components ─── */

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
      <Icon className="w-3.5 h-3.5 text-stone-400" />
      <p className="text-xs font-bold text-stone-600 uppercase tracking-wider">{title}</p>
    </div>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-stone-500 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function RangeField({ label, value, min, max, step = 1, onChange, format }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] font-medium text-stone-500">{label}</label>
        <span className="text-[11px] font-bold text-stone-700">{format ? format(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-stone-200 rounded-full appearance-none cursor-pointer accent-primary-500" />
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-stone-500 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg border border-stone-200 cursor-pointer" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
      </div>
    </div>
  );
}

function ToggleField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className={`relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-primary-500" : "bg-stone-300"}`}
        onClick={() => onChange(!checked)}>
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </div>
      <span className="text-sm text-stone-700 font-medium">{label}</span>
    </label>
  );
}
