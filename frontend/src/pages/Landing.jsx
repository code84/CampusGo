import React from "react";
import { Link } from "react-router-dom";
import { Lightning, MapTrifold, Car, ChartLineUp, ShieldCheck, Star } from "@phosphor-icons/react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden grain">
      {/* glow */}
      <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(circle, #FFB800 0%, transparent 70%)" }} />
      <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full opacity-10 blur-3xl" style={{ background: "radial-gradient(circle, #007AFF 0%, transparent 70%)" }} />

      <header className="relative z-10 px-6 lg:px-12 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-[#FFB800] grid place-items-center">
            <Lightning weight="fill" size={22} color="#000" />
          </div>
          <div>
            <div className="font-display font-bold text-xl leading-none">CampusGo</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mt-1">IIT Roorkee Mobility</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" data-testid="header-login" className="text-sm text-zinc-300 hover:text-white px-4 py-2">Log in</Link>
          <Link to="/register" data-testid="header-register" className="text-sm font-semibold bg-[#FFB800] text-black hover:bg-[#E5A600] transition-colors px-4 py-2 rounded-md">
            Get started
          </Link>
        </div>
      </header>

      <section className="relative z-10 px-6 lg:px-12 pt-16 pb-24 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-950/60 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-400">Live dispatch · v1.0</span>
            </div>
            <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
              Real-time rides<br />for the
              <span className="text-[#FFB800]"> campus</span>.
            </h1>
            <p className="mt-6 text-lg text-zinc-400 max-w-xl leading-relaxed">
              A purpose-built dispatch system for e-rickshaws across IIT Roorkee.
              Request a ride, get matched in seconds, and watch it unfold live —
              no group chats, no missed pickups.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/register?role=passenger" data-testid="cta-passenger" className="px-6 py-3 rounded-md bg-[#FFB800] text-black font-semibold hover:bg-[#E5A600] transition-colors inline-flex items-center justify-center gap-2">
                <MapTrifold weight="bold" size={18} />
                Book a ride
              </Link>
              <Link to="/register?role=driver" data-testid="cta-driver" className="px-6 py-3 rounded-md border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 transition-colors inline-flex items-center justify-center gap-2">
                <Car weight="bold" size={18} />
                Drive on CampusGo
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              <div>
                <div className="font-mono-num text-2xl font-bold text-white">12k+</div>
                <div className="text-xs text-zinc-500 mt-1">Trips / month</div>
              </div>
              <div>
                <div className="font-mono-num text-2xl font-bold text-white">42</div>
                <div className="text-xs text-zinc-500 mt-1">E-rickshaws</div>
              </div>
              <div>
                <div className="font-mono-num text-2xl font-bold text-white">~90s</div>
                <div className="text-xs text-zinc-500 mt-1">Avg wait</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 fade-up">
              <img src="https://images.pexels.com/photos/34929879/pexels-photo-34929879.jpeg" alt="Campus at night" className="w-full h-[520px] object-cover opacity-70" />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
              <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
                <div className="px-3 py-1.5 rounded-md bg-zinc-950/80 backdrop-blur border border-zinc-800 text-xs flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
                  Live · 4 drivers online
                </div>
                <div className="px-3 py-1.5 rounded-md bg-[#FFB800] text-black text-xs font-bold font-mono-num">UK07 AB 1234</div>
              </div>
              <div className="absolute bottom-0 inset-x-0 p-6">
                <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-400 mb-2">Active Ride</div>
                <div className="font-display font-bold text-xl">Bhawan → Lecture Hall Complex</div>
                <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5"><Star weight="fill" size={12} className="text-[#FFB800]" /> 4.9</span>
                  <span>ETA 3 min</span>
                  <span className="font-mono-num">₹30</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 lg:px-12 py-20 border-t border-zinc-900 max-w-7xl mx-auto">
        <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3">Built for both sides</div>
        <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight max-w-2xl">
          One platform. Real-time everywhere.
        </h2>
        <div className="grid md:grid-cols-3 gap-px bg-zinc-900 mt-12 border border-zinc-900 rounded-md overflow-hidden">
          {[
            { icon: Lightning, t: "WebSocket-first", d: "Ride state, availability and locations sync across all clients in real-time." },
            { icon: ChartLineUp, t: "Operational analytics", d: "Peak demand windows, top pickup points and per-driver performance, charted." },
            { icon: ShieldCheck, t: "Atomic dispatch", d: "First-driver-wins assignment guarantees a ride is never double-allocated." },
          ].map(({ icon: Icon, t, d }, i) => (
            <div key={i} className="p-8 bg-zinc-950 hover:bg-zinc-900/60 transition-colors">
              <Icon size={28} className="text-[#FFB800]" weight="duotone" />
              <div className="font-display font-bold text-lg mt-4">{t}</div>
              <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 px-6 lg:px-12 py-8 border-t border-zinc-900 text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
        <div>© 2026 CampusGo · IIT Roorkee mobility platform</div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="hover:text-white">Sign in</Link>
          <Link to="/register" className="hover:text-white">Create account</Link>
        </div>
      </footer>
    </div>
  );
}
