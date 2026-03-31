import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Server, User, Key, Save, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button, Input } from "../components/UI";

export default function Settings() {
  const { user } = useAuth();
  const [apiUrl, setApiUrl] = useState(
    localStorage.getItem("api_url") || "http://localhost:4040"
  );
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const saveUrl = () => {
    localStorage.setItem("api_url", apiUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${apiUrl}/admin/stats`);
      if (res.ok) setTestResult("success");
      else setTestResult("error");
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-xl">
      <div className="animate-slide-up">
        <h1 className="text-snow text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-soft text-sm mt-1">Configure your connection and preferences</p>
      </div>

      {/* Profile card */}
      <div className="bg-card border border-edge rounded-2xl p-6 animate-slide-up" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center gap-3 mb-4">
          <User size={15} className="text-soft" />
          <h2 className="text-snow font-semibold text-sm">Profile</h2>
        </div>
        <div className="space-y-3">
          <InfoRow label="Name"  value={user?.name}  />
          <InfoRow label="Role"  value={user?.role}  mono />
          <InfoRow label="ID"    value={user?.user_id} mono />
        </div>
      </div>

      {/* Server config */}
      <div className="bg-card border border-edge rounded-2xl p-6 animate-slide-up" style={{ animationDelay: "160ms" }}>
        <div className="flex items-center gap-3 mb-4">
          <Server size={15} className="text-soft" />
          <h2 className="text-snow font-semibold text-sm">Backend Server</h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs text-soft font-medium">API Base URL</label>
            <input
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              className="w-full bg-ink border border-edge rounded-xl text-sm text-snow font-mono
                focus:outline-none focus:border-azure-500 transition-all px-4 py-2.5"
            />
          </div>

          {testResult === "success" && (
            <div className="flex items-center gap-2 text-jade-400 text-xs bg-jade-500/10 border border-jade-500/20 rounded-xl px-3 py-2.5">
              <CheckCircle2 size={13} /> Connected successfully
            </div>
          )}
          {testResult === "error" && (
            <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5">
              <AlertTriangle size={13} /> Could not connect — check URL and server status
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={testConnection} variant="secondary" loading={testing}>
              Test Connection
            </Button>
            <Button onClick={saveUrl} variant="primary">
              {saved ? <><CheckCircle2 size={13} /> Saved</> : <><Save size={13} /> Save</>}
            </Button>
          </div>
        </div>
      </div>

      {/* API reference */}
      <div className="bg-card border border-edge rounded-2xl p-6 animate-slide-up" style={{ animationDelay: "240ms" }}>
        <div className="flex items-center gap-3 mb-4">
          <Key size={15} className="text-soft" />
          <h2 className="text-snow font-semibold text-sm">API Reference</h2>
        </div>
        <div className="space-y-2">
          {[
            ["POST", "/login",                "Authenticate user"],
            ["GET",  "/courses/:profId",       "Get professor courses"],
            ["POST", "/startSession",          "Start attendance session"],
            ["POST", "/endSession/:id",        "End a session"],
            ["GET",  "/activeSession",         "Get active session for course"],
            ["GET",  "/getQR/:sessionId",      "Get refreshing QR token"],
            ["GET",  "/attendance/:sessionId", "Get session attendance"],
            ["POST", "/markAttendance",        "Mark student attendance"],
            ["GET",  "/getMinor?major=",       "Get BLE minor value"],
            ["GET",  "/validate",              "Validate BLE beacon"],
            ["GET",  "/admin/stats",           "System-wide stats"],
            ["GET",  "/analytics/course/:id",  "Per-course analytics"],
            ["GET",  "/analytics/prof/:id",    "Professor analytics"],
          ].map(([method, path, desc], i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-edge last:border-0">
              <span className={`text-xs font-mono font-bold w-10 shrink-0 ${
                method === "POST" ? "text-amber-400" : "text-azure-400"
              }`}>{method}</span>
              <span className="text-snow text-xs font-mono flex-1 truncate">{path}</span>
              <span className="text-dim text-xs hidden md:block">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-edge last:border-0">
      <span className="text-soft text-xs">{label}</span>
      <span className={`text-snow text-sm ${mono ? "font-mono" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}
