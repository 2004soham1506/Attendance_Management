import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, Eye, EyeOff, GraduationCap } from "lucide-react";
import { Button, Input } from "../components/UI";

export default function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const { login } = useAuth();

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-azure-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-500/6 rounded-full blur-3xl pointer-events-none" />

      {/* Grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative w-full max-w-sm animate-slide-up">
        {/* Card */}
        <div className="bg-card border border-edge rounded-2xl p-8 shadow-float">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-azure-500 flex items-center justify-center mb-4 shadow-glow">
              <GraduationCap size={26} className="text-white" />
            </div>
            <h1 className="text-snow font-bold text-xl tracking-tight">Welcome back</h1>
            <p className="text-soft text-sm mt-1">DIAMS · IIT Hyderabad</p>
          </div>

          <form onSubmit={handle} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs text-soft font-medium">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
                <input
                  type="email" required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@iith.ac.in"
                  className="w-full bg-ink border border-edge rounded-xl text-sm text-snow placeholder:text-dim
                    focus:outline-none focus:border-azure-500 focus:ring-1 focus:ring-azure-500/30 transition-all pl-10 pr-4 py-2.5"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-xs text-soft font-medium">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
                <input
                  type={showPwd ? "text" : "password"} required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-ink border border-edge rounded-xl text-sm text-snow placeholder:text-dim
                    focus:outline-none focus:border-azure-500 focus:ring-1 focus:ring-azure-500/30 transition-all pl-10 pr-10 py-2.5"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dim hover:text-soft transition-colors">
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} disabled={!email || !password} className="w-full mt-2" size="lg">
              Sign In
            </Button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-6 p-3 rounded-xl bg-white/3 border border-edge">
            <p className="text-dim text-xs font-mono text-center">
              Demo: bob1@test.com / password123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
