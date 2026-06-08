import React from "react";

export function StatCard({ label, value, sub, accent, testId }) {
  return (
    <div data-testid={testId} className="p-6 bg-zinc-950 border border-zinc-900 rounded-md hover:-translate-y-0.5 transition-transform">
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3">{label}</div>
      <div className={`font-mono-num text-3xl font-semibold ${accent || "text-white"}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-2">{sub}</div>}
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    requested: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", label: "Requested" },
    accepted: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", label: "Accepted" },
    in_progress: { bg: "bg-violet-500/10", text: "text-violet-300", border: "border-violet-500/30", label: "In Progress" },
    completed: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", label: "Completed" },
    cancelled: { bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/30", label: "Cancelled" },
  };
  const s = map[status] || map.requested;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest border ${s.bg} ${s.text} ${s.border} font-medium`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.text.replace("text", "bg")}`} />
      {s.label}
    </span>
  );
}

export function Spinner({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="#27272a" strokeWidth="3" fill="none" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="#FFB800" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function SectionTitle({ children, sub, action }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{children}</h2>
        {sub && <p className="text-sm text-zinc-500 mt-1">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
