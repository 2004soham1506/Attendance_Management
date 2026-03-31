import { Loader2 } from "lucide-react";

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon: Icon, color = "azure", delay = 0 }) {
  const palette = {
    azure:  { bg: "bg-azure-500/10",  text: "text-azure-400",  border: "border-azure-500/20"  },
    jade:   { bg: "bg-jade-500/10",   text: "text-jade-400",   border: "border-jade-500/20"   },
    amber:  { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/20"  },
    rose:   { bg: "bg-rose-500/10",   text: "text-rose-400",   border: "border-rose-500/20"   },
    violet: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
  }[color];

  return (
    <div
      className="animate-slide-up bg-card border border-edge rounded-2xl p-5 flex flex-col gap-3"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <p className="text-soft text-xs font-medium uppercase tracking-widest">{label}</p>
        {Icon && (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${palette.bg} ${palette.border} border`}>
            <Icon size={15} className={palette.text} />
          </div>
        )}
      </div>
      <div>
        <p className="text-snow text-3xl font-bold leading-none tracking-tight">{value}</p>
        {sub && <p className="text-soft text-xs mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ label, variant = "default" }) {
  const map = {
    default: "bg-white/8 text-mist",
    ble:     "bg-azure-500/15 text-azure-400 border border-azure-500/20",
    qr:      "bg-jade-500/15 text-jade-400 border border-jade-500/20",
    hybrid:  "bg-violet-500/15 text-violet-400 border border-violet-500/20",
    manual:  "bg-amber-500/15 text-amber-400 border border-amber-500/20",
    live:    "bg-jade-500/15 text-jade-400 border border-jade-500/25",
    ended:   "bg-white/5 text-soft",
    good:    "bg-jade-500/15 text-jade-400",
    warn:    "bg-amber-500/15 text-amber-400",
    danger:  "bg-rose-500/15 text-rose-400",
    prof:    "bg-violet-500/15 text-violet-400",
    admin:   "bg-rose-500/15 text-rose-400",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium font-mono ${map[variant] ?? map.default}`}>
      {variant === "live" && <span className="w-1.5 h-1.5 rounded-full bg-jade-400 animate-pulse" />}
      {label}
    </span>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, size = "sm" }) {
  const pct   = Math.min(100, (value / max) * 100);
  const color = pct >= 75 ? "bg-jade-500" : pct >= 60 ? "bg-amber-500" : "bg-rose-500";
  const h     = size === "sm" ? "h-1.5" : "h-2.5";
  return (
    <div className={`w-full ${h} rounded-full bg-edge overflow-hidden`}>
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Button({ children, onClick, variant = "primary", size = "md", disabled, loading, className = "", type = "button" }) {
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none";
  const variants = {
    primary:   "bg-azure-500 hover:bg-azure-400 text-white shadow-glow",
    secondary: "bg-edge hover:bg-dim/60 text-snow border border-edge",
    ghost:     "hover:bg-white/5 text-soft hover:text-snow",
    danger:    "bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20",
    jade:      "bg-jade-500/15 hover:bg-jade-500/25 text-jade-400 border border-jade-500/20",
  };
  const sizes = {
    xs: "px-2.5 py-1.5 text-xs",
    sm: "px-3 py-2 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-sm",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ label, icon: Icon, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs text-soft font-medium">{label}</label>}
      <div className="relative">
        {Icon && <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />}
        <input
          {...props}
          className={`w-full bg-ink border border-edge rounded-xl text-sm text-snow placeholder:text-dim
            focus:outline-none focus:border-azure-500 focus:ring-1 focus:ring-azure-500/30 transition-all
            ${Icon ? "pl-10 pr-4" : "px-4"} py-2.5`}
        />
      </div>
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({ label, children, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs text-soft font-medium">{label}</label>}
      <select
        {...props}
        className="w-full bg-ink border border-edge rounded-xl text-sm text-snow px-4 py-2.5
          focus:outline-none focus:border-azure-500 transition-all appearance-none cursor-pointer"
      >
        {children}
      </select>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function Empty({ icon: Icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      {Icon && <div className="w-14 h-14 rounded-2xl bg-edge flex items-center justify-center"><Icon size={24} className="text-dim" /></div>}
      <p className="text-snow font-medium">{title}</p>
      {sub && <p className="text-soft text-sm max-w-xs">{sub}</p>}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 20 }) {
  return <Loader2 size={size} className="animate-spin text-azure-400" />;
}

// ── Section header ────────────────────────────────────────────────────────────
export function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-snow font-semibold text-base">{title}</h2>
      {action}
    </div>
  );
}

// ── Tooltip-style label ───────────────────────────────────────────────────────
export function AttendancePct({ value }) {
  const color = value >= 75 ? "text-jade-400" : value >= 60 ? "text-amber-400" : "text-rose-400";
  return <span className={`font-mono font-bold text-sm ${color}`}>{value.toFixed(0)}%</span>;
}
