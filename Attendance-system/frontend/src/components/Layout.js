import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, BookOpen, BarChart3, Shield,
  LogOut, GraduationCap, ChevronLeft, ChevronRight,
  Bell, Users,
} from "lucide-react";
import { useState } from "react";

const NAV_PROF = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: BookOpen,         label: "Courses",   id: "courses"   },
  { icon: Users,            label: "Students",  id: "students"  },
  { icon: BarChart3,        label: "Analytics", id: "analytics" },
];

const NAV_ADMIN = [
  { icon: LayoutDashboard, label: "Admin",  id: "dashboard" },
  { icon: BookOpen,         label: "Courses",   id: "courses"   },
  { icon: Users,            label: "Students",  id: "students"  },
  { icon: BarChart3,        label: "Analytics", id: "analytics" },
  // { icon: Shield,           label: "Admin",     id: "admin"     },
];

export default function Layout({ page, setPage, children }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const nav = user?.role === "admin" ? NAV_ADMIN : NAV_PROF;

  // Header label — find from nav, fallback gracefully
  const pageLabel = nav.find(n => n.id === page)?.label ?? "Dashboard";

  return (
    <div className="flex h-screen bg-ink overflow-hidden">
      <aside className={`flex flex-col bg-card border-r border-edge shrink-0 transition-all duration-300 ${collapsed ? "w-16" : "w-56"}`}>
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-edge ${collapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-xl bg-azure-500 flex items-center justify-center shrink-0 shadow-glow">
            <GraduationCap size={15} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-snow font-bold text-sm leading-none">DIAMS</p>
              <p className="text-soft text-xs mt-0.5">IIT Hyderabad</p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-0.5 mt-1">
          {nav.map(({ icon: Icon, label, id }) => (
            <button key={id} onClick={() => setPage(id)} title={collapsed ? label : ""}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${page === id ? "nav-active" : "text-soft hover:text-snow hover:bg-white/5"}
                ${collapsed ? "justify-center" : ""}`}>
              <Icon size={16} className="shrink-0" />
              {!collapsed && label}
            </button>
          ))}
        </nav>

        <div className="p-2 border-t border-edge space-y-0.5">
          {!collapsed && (
            <div className="px-3 py-2.5 rounded-xl bg-white/4 mb-1">
              <p className="text-snow text-xs font-medium truncate">{user?.name}</p>
              <p className="text-soft text-xs truncate capitalize">
                {user?.role}
                {user?.taCourseIds?.length > 0 && (
                  <span className="ml-1 text-violet-400">(+TA)</span>
                )}
              </p>
            </div>
          )}
          <button onClick={logout} title={collapsed ? "Log out" : ""}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-soft hover:text-rose-400 hover:bg-rose-500/8 transition-all ${collapsed ? "justify-center" : ""}`}>
            <LogOut size={15} className="shrink-0" />
            {!collapsed && "Log out"}
          </button>
          <button onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-2 text-dim hover:text-soft transition-colors">
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-edge bg-card/50 backdrop-blur-sm shrink-0">
          <div>
            <h1 className="text-snow font-semibold text-sm capitalize">{pageLabel}</h1>
            <p className="text-soft text-xs mt-0.5">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="w-8 h-8 rounded-xl bg-edge flex items-center justify-center text-soft hover:text-snow transition-colors"
              onClick={() => alert("Notifications coming soon")}
            >
              <Bell size={14} />
            </button>
            <div className="w-8 h-8 rounded-xl bg-azure-500 flex items-center justify-center text-xs font-bold text-white select-none">
              {user?.name?.[0] ?? "P"}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}