export default function Card({ children, className = "", padding = true, hover = false }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-stone-200/70 shadow-sm ${
        hover ? "hover:shadow-md hover:border-stone-300/70 transition-all duration-200" : ""
      } ${padding ? "p-6" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
