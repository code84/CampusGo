import React, { useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { Lightning, Eye, EyeSlash } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}`);
      nav(user.role === "driver" ? "/driver" : "/passenger", { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (em, pw) => { setEmail(em); setPassword(pw); };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#09090b] text-white">
      <div className="hidden lg:block relative overflow-hidden">
        <img src="https://images.pexels.com/photos/34929879/pexels-photo-34929879.jpeg" className="absolute inset-0 w-full h-full object-cover" alt="" />
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950/80 via-zinc-950/40 to-zinc-950/90" />
        <div className="relative z-10 p-12 flex flex-col h-full">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-md bg-[#FFB800] grid place-items-center">
              <Lightning weight="fill" size={22} color="#000" />
            </div>
            <div>
              <div className="font-display font-bold text-xl leading-none">CampusGo</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-400 mt-1">IIT Roorkee</div>
            </div>
          </Link>
          <div className="mt-auto">
            <h2 className="font-display font-bold text-4xl leading-tight max-w-md">Move across campus, instantly.</h2>
            <p className="text-zinc-400 mt-3 max-w-md">Real-time dispatch for the campus e-rickshaw network.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md fade-up">
          <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">Sign in</div>
          <h1 className="font-display font-bold text-3xl tracking-tight">Welcome back.</h1>
          <p className="text-sm text-zinc-500 mt-2">Use your campus credentials to continue.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-400 mb-2 block">Email</label>
              <input
                data-testid="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@iitr.ac.in"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#FFB800] focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-400 mb-2 block">Password</label>
              <div className="relative">
                <input
                  data-testid="login-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-4 py-3 pr-12 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#FFB800] focus:border-transparent"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  {showPw ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              data-testid="login-submit"
              disabled={loading}
              className="w-full bg-[#FFB800] hover:bg-[#E5A600] text-black font-semibold py-3 rounded-md transition-colors disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-8 p-4 rounded-md border border-zinc-900 bg-zinc-950">
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-3">Demo accounts · click to fill</div>
            <div className="space-y-2 text-xs">
              <button data-testid="demo-passenger" onClick={() => quickFill("passenger@iitr.ac.in", "passenger123")} className="w-full text-left px-3 py-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex justify-between">
                <span className="text-zinc-300">Passenger</span>
                <span className="font-mono-num text-zinc-500">passenger@iitr.ac.in</span>
              </button>
              <button data-testid="demo-driver" onClick={() => quickFill("driver1@iitr.ac.in", "driver123")} className="w-full text-left px-3 py-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex justify-between">
                <span className="text-zinc-300">Driver</span>
                <span className="font-mono-num text-zinc-500">driver1@iitr.ac.in</span>
              </button>
            </div>
          </div>

          <p className="text-sm text-zinc-500 mt-6 text-center">
            New here? <Link to="/register" className="text-[#FFB800] hover:underline" data-testid="login-go-register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
