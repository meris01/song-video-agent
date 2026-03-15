import { Loader2 } from "lucide-react";

const V = {
  primary:
    "bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:from-primary-700 hover:to-primary-600 shadow-md shadow-primary-600/20 active:shadow-sm",
  secondary:
    "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50 hover:border-stone-300 shadow-sm active:bg-stone-100",
  danger:
    "bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-700 hover:to-red-600 shadow-md shadow-red-600/20",
  ghost:
    "text-stone-500 hover:bg-stone-100 hover:text-stone-700 active:bg-stone-200",
  accent:
    "bg-gradient-to-r from-primary-600 to-amber-500 text-white hover:from-primary-700 hover:to-amber-600 shadow-md shadow-primary-600/20",
};

export default function Button({
  children,
  variant = "primary",
  loading = false,
  disabled = false,
  className = "",
  size = "md",
  ...props
}) {
  const sz = size === "sm" ? "px-3 py-1.5 text-xs" : size === "lg" ? "px-6 py-3 text-sm" : "px-4 py-2.5 text-[13px]";
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${sz} ${V[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
