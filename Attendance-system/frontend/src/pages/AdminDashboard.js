import { useState, useEffect } from "react";
import { getAdminStats } from "../api/client";
import { Shield, Database, Activity, Users, AlertTriangle, CheckCircle2, Server } from "lucide-react";
import { Badge, Spinner } from "../components/UI";

export default function AdminDashboard() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await getAdminStats();
        setStats(res.data);
        setError(null);
      } catch {
        setError("Could not load stats — check backend connection.");
      } finally {
        setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Spinner size={28} /></div>
  );

  const services = [
    { name: "Flask API",         status: !error, detail: "http://localhost:4040"          },
    { name: "PostgreSQL DB",     status: !error, detail: "db:5432 / attendance"           },
    { name: "BLE Beacon Server", status: true,   detail: "http://localhost:4040/getMinor" },
    { name: "JWT Auth",          status: true,   detail: "HS256 / dev-secret"             },
  ];

  const actions = [
    { label: "Seed Database",     icon: Database, note: "Run seed.py to populate"       },
    { label: "View All Sessions", icon: Activity, note: "GET /admin/stats"               },
    { label: "Manage Users",      icon: Users,    note: "Add via DB / API"               },
    { label: "Server Logs",       icon: Server,   note: "docker logs attendance-backend" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-slide-up flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center border border-rose-500/20">
          <Shield size={18} className="text-rose-400" />
        </div>
        <div>
          <h1 className="text-snow text-2xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-soft text-sm mt-0.5">System management and service health</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4 animate-slide-up">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-300 text-sm">{error}</p>
        </div>
      )}

      {/* Quick stat strip */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: "80ms" }}>
          {[
            { label: "Sessions",        value: stats.sessions,                        color: "text-azure-400" },
            { label: "Attendance Marks", value: stats.attendance,                     color: "text-jade-400"  },
            { label: "Avg / Session",   value: stats.avg_attendance?.toFixed(1) ?? 0, color: "text-violet-400" },
          ].map((s, i) => (
            <div key={i} className="bg-card border border-edge rounded-2xl p-4 text-center">
              <p className="text-soft text-xs uppercase tracking-widest mb-1">{s.label}</p>
              <p className={`text-3xl font-bold font-mono ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Service health */}
      <div className="bg-card border border-edge rounded-2xl p-6 animate-slide-up" style={{ animationDelay: "160ms" }}>
        <h2 className="text-snow font-semibold text-sm mb-4">Service Health</h2>
        <div className="space-y-3">
          {services.map((svc, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-ink border border-edge">
              <div className={`w-2 h-2 rounded-full ${svc.status ? "bg-jade-400" : "bg-rose-400"} animate-pulse`} />
              <div className="flex-1">
                <p className="text-snow text-sm font-medium">{svc.name}</p>
                <p className="text-dim text-xs font-mono">{svc.detail}</p>
              </div>
              <Badge label={svc.status ? "UP" : "DOWN"} variant={svc.status ? "live" : "danger"} />
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-card border border-edge rounded-2xl p-6 animate-slide-up" style={{ animationDelay: "240ms" }}>
        <h2 className="text-snow font-semibold text-sm mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((a, i) => (
            <div key={i}
              className="p-4 rounded-xl bg-ink border border-edge hover:border-dim transition-colors cursor-pointer group"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-edge flex items-center justify-center shrink-0 group-hover:bg-dim transition-colors">
                  <a.icon size={14} className="text-soft" />
                </div>
                <div>
                  <p className="text-snow text-xs font-medium">{a.label}</p>
                  <p className="text-dim text-xs mt-0.5 font-mono">{a.note}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timezone note */}
      <div className="flex items-center gap-2 px-1 animate-slide-up" style={{ animationDelay: "300ms" }}>
        <CheckCircle2 size={13} className="text-jade-400 shrink-0" />
        <p className="text-dim text-xs font-mono">
          All timestamps stored in UTC · displayed in IST (UTC+5:30) throughout the portal
        </p>
      </div>
    </div>
  );
}