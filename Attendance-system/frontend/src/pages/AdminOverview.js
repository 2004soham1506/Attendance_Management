import { useState, useEffect } from "react";
import { getAdminStats } from "../api/client";
import { LayoutDashboard, BookOpen, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { StatCard, Spinner } from "../components/UI";

function nowIST() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminOverview() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [istTime, setIstTime] = useState(nowIST());

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
    const dataTimer  = setInterval(load, 15_000);
    const clockTimer = setInterval(() => setIstTime(nowIST()), 30_000);
    return () => { clearInterval(dataTimer); clearInterval(clockTimer); };
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Spinner size={28} /></div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-slide-up flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-azure-500/15 flex items-center justify-center border border-azure-500/20">
            <LayoutDashboard size={18} className="text-azure-400" />
          </div>
          <div>
            <h1 className="text-snow text-2xl font-bold tracking-tight">Overview</h1>
            <p className="text-soft text-sm mt-0.5">System-wide attendance summary</p>
          </div>
        </div>
        <p className="text-dim text-xs font-mono hidden md:block">{istTime} IST</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4 animate-slide-up">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-300 text-sm">{error}</p>
        </div>
      )}

      {/* Live stats — lecture-based */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Lectures"   value={stats?.lectures   ?? "—"} icon={BookOpen}    color="azure"  delay={0}   />
        <StatCard label="Total Students"   value={stats?.students   ?? "—"} icon={Users}       color="jade"   delay={80}  />
        <StatCard label="Total Courses"    value={stats?.courses    ?? "—"} icon={LayoutDashboard} color="violet" delay={160} />
        <StatCard label="Active Sessions"  value={stats?.sessions   ?? "—"} icon={TrendingUp}  color="amber"  delay={240} />
        <StatCard label="Enrollments"      value={stats?.enrollments ?? "—"} icon={Users}       color="rose"   delay={320} />
        <StatCard label="Professors"       value={stats?.professors ?? "—"} icon={Users}       color="azure"  delay={400} />
      </div>

      {/* Summary note */}
      <div className="bg-card border border-edge rounded-2xl p-6 animate-slide-up" style={{ animationDelay: "200ms" }}>
        <h2 className="text-snow font-semibold text-sm mb-3">System Summary</h2>
        <p className="text-soft text-sm leading-relaxed">
          DIAMS is tracking{" "}
          <span className="text-snow font-medium">{stats?.courses ?? 0}</span> courses with{" "}
          <span className="text-snow font-medium">{stats?.enrollments ?? 0}</span> active student enrollments.
        </p>
        <p className="text-dim text-xs mt-3 font-mono">Data refreshes every 15 seconds. All times shown in IST (UTC+5:30).</p>
      </div>
    </div>
  );
}