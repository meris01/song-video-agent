const V = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200/80 ring-1 ring-emerald-500/10",
  warning: "bg-amber-50 text-amber-700 border-amber-200/80 ring-1 ring-amber-500/10",
  error: "bg-red-50 text-red-700 border-red-200/80 ring-1 ring-red-500/10",
  info: "bg-sky-50 text-sky-700 border-sky-200/80 ring-1 ring-sky-500/10",
  neutral: "bg-stone-50 text-stone-600 border-stone-200/80",
  accent: "bg-primary-50 text-primary-700 border-primary-200/80 ring-1 ring-primary-500/10",
};

export default function StatusBadge({ variant = "neutral", children, dot = false }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${V[variant]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${variant === "success" ? "bg-emerald-500" : variant === "error" ? "bg-red-500" : variant === "warning" ? "bg-amber-500" : "bg-primary-500"}`} />}
      {children}
    </span>
  );
}
