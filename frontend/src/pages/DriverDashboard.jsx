import React, { useEffect, useState, useCallback } from "react";
import AppLayout from "../components/AppLayout";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { useSocket } from "../lib/SocketContext";
import { StatCard, StatusBadge, Spinner, SectionTitle } from "../components/Bits";
import LiveMap from "../components/LiveMap";
import { Star, MapPin, Flag, Power, CheckCircle, X, Play, Lightning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function DriverDashboard() {
  const { user, refreshUser } = useAuth();
  const { subscribe } = useSocket();
  const [analytics, setAnalytics] = useState(null);
  const [rides, setRides] = useState([]);
  const [available, setAvailable] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [online, setOnline] = useState(!!user?.is_online);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ data: a }, { data: m }, { data: av }] = await Promise.all([
        api.get("/analytics/driver"),
        api.get("/rides/mine"),
        api.get("/rides/available").catch(() => ({ data: [] })),
      ]);
      setAnalytics(a);
      setRides(m);
      setAvailable(av);
      const active = m.find((r) => ["accepted", "in_progress"].includes(r.status));
      setActiveRide(active || null);
    } catch (e) { toast.error(formatApiError(e)); }
  }, []);

  useEffect(() => { load(); refreshUser?.(); }, [load,refreshUser]);
  useEffect(() => { setOnline(!!user?.is_online); }, [user]);

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === "new_ride_request") {
        toast.info("New ride request available!", { duration: 4000 });
        setAvailable((prev) => prev.find((r) => r.id === msg.ride.id) ? prev : [msg.ride, ...prev]);
      }
      if (msg.type === "ride_taken") {
        setAvailable((prev) => prev.filter((r) => r.id !== msg.ride_id));
      }
      if (msg.type === "ride_update" && msg.ride?.driver_id === user?.id) {
        load();
      }
    });
    return unsub;
  }, [subscribe, load, user]);

  const toggleOnline = async () => {
    setLoading(true);
    try {
      // Use approximate IIT Roorkee center as default location
      const lat = user?.lat || 29.8648 + (Math.random() - 0.5) * 0.005;
      const lng = user?.lng || 77.8964 + (Math.random() - 0.5) * 0.005;
      const { data } = await api.post("/drivers/availability", { is_online: !online, lat, lng });
      setOnline(data.is_online);
      toast.success(data.is_online ? "You're online" : "You went offline");
      refreshUser?.();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };

  const acceptRide = async (ride) => {
    try {
      const { data } = await api.post(`/rides/${ride.id}/accept`);
      toast.success("Ride accepted");
      setActiveRide(data);
      setAvailable((prev) => prev.filter((r) => r.id !== ride.id));
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const rejectRide = async (ride) => {
    try {
      await api.post(`/rides/${ride.id}/reject`);
      setAvailable((prev) => prev.filter((r) => r.id !== ride.id));
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const startRide = async () => {
    if (!activeRide) return;
    try {
      const { data } = await api.post(`/rides/${activeRide.id}/start`);
      setActiveRide(data);
      toast.success("Ride started");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const completeRide = async () => {
    if (!activeRide) return;
    try {
      const { data } = await api.post(`/rides/${activeRide.id}/complete`);
      toast.success("Ride completed!");
      setActiveRide(null);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <AppLayout>
      <div className="px-6 lg:px-10 py-8 max-w-7xl">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">Driver dashboard</div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Hi, {user?.name?.split(" ")[0]}.</h1>
            <p className="text-sm text-zinc-500 mt-1 font-mono-num">{user?.vehicle_model} · {user?.vehicle_number}</p>
          </div>

          <button
            data-testid="driver-online-toggle"
            disabled={loading}
            onClick={toggleOnline}
            className={`px-5 py-3 rounded-md font-semibold text-sm transition-all flex items-center gap-2 border ${
              online
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800"
            }`}
          >
            {loading ? <Spinner size={14} /> : <Power size={16} weight={online ? "fill" : "regular"} />}
            {online ? "Online · accepting rides" : "Go online"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <StatCard testId="stat-total" label="Total Rides" value={analytics?.total_rides ?? 0} />
          <StatCard testId="stat-completed" label="Completed" value={analytics?.completed ?? 0} accent="text-emerald-400" />
          <StatCard testId="stat-active" label="Active" value={analytics?.active ?? 0} accent="text-[#FFB800]" />
          <StatCard testId="stat-rating" label="Rating" value={Number(analytics?.rating_avg || 5).toFixed(1)} sub={`${analytics?.rating_count || 0} reviews`} />
          <StatCard testId="stat-earnings" label="Earnings" value={`₹${analytics?.earnings_estimate ?? 0}`} accent="text-emerald-400" sub="Estimated · ₹30/ride" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            {activeRide ? (
              <DriverActiveRide ride={activeRide} onStart={startRide} onComplete={completeRide} />
            ) : (
              <div className="border border-zinc-900 bg-zinc-950 rounded-md p-6 fade-up" data-testid="ride-inbox-card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Ride Inbox</div>
                    <div className="font-display font-bold text-lg mt-1 flex items-center gap-2">
                      {available.length} pending
                      {online && available.length > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500 live-dot" />}
                    </div>
                  </div>
                  <Link to="/driver/inbox" className="text-xs text-[#FFB800] hover:underline">Open</Link>
                </div>
                {!online ? (
                  <p className="text-sm text-zinc-500">You're currently offline. Go online to receive ride requests.</p>
                ) : available.length === 0 ? (
                  <p className="text-sm text-zinc-500">Waiting for ride requests…</p>
                ) : (
                  <div className="space-y-2">
                    {available.slice(0, 2).map((r) => (
                      <InboxItem key={r.id} ride={r} onAccept={() => acceptRide(r)} onReject={() => rejectRide(r)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="border border-zinc-900 bg-zinc-950 rounded-md overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-900">
                <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Your position</div>
              </div>
              <LiveMap
                drivers={user?.lat ? [{ id: user.id, name: user.name, vehicle_model: user.vehicle_model, vehicle_number: user.vehicle_number, lat: user.lat, lng: user.lng, rating_avg: user.rating_avg }] : []}
                height={400}
                pickup={activeRide && activeRide.pickup_lat ? { lat: activeRide.pickup_lat, lng: activeRide.pickup_lng, label: activeRide.pickup } : null}
                destination={activeRide && activeRide.dest_lat ? { lat: activeRide.dest_lat, lng: activeRide.dest_lng, label: activeRide.destination } : null}
                driverLocation={activeRide && user?.lat ? { lat: user.lat, lng: user.lng } : null}
              />
            </div>

            <div className="border border-zinc-900 bg-zinc-950 rounded-md p-6">
              <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4">Recent rides</div>
              <div className="space-y-2" data-testid="recent-rides-list">
                {rides.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center justify-between border-b border-zinc-900 last:border-0 py-3">
                    <div>
                      <div className="text-sm">{r.pickup} → {r.destination}</div>
                      <div className="text-xs text-zinc-500 font-mono-num">{new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {r.rating && <span className="text-xs text-[#FFB800] flex items-center gap-1"><Star size={12} weight="fill" />{r.rating}</span>}
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                ))}
                {rides.length === 0 && <p className="text-zinc-500 text-sm">No rides yet.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function InboxItem({ ride, onAccept, onReject }) {
  return (
    <div className="p-3 border border-zinc-900 rounded-md bg-black/40">
      <div className="text-xs text-zinc-500 mb-1">{ride.passenger?.name || "Passenger"}</div>
      <div className="text-sm flex items-center gap-2">
        <MapPin size={14} className="text-emerald-400" weight="fill" /> {ride.pickup}
      </div>
      <div className="text-sm flex items-center gap-2 mt-1">
        <Flag size={14} className="text-rose-400" weight="fill" /> {ride.destination}
      </div>
      <div className="mt-3 flex gap-2">
        <button data-testid={`accept-ride-${ride.id}`} onClick={onAccept} className="flex-1 bg-[#FFB800] hover:bg-[#E5A600] text-black text-xs font-semibold py-2 rounded transition-colors flex items-center justify-center gap-1">
          <CheckCircle size={14} weight="fill" /> Accept
        </button>
        <button data-testid={`reject-ride-${ride.id}`} onClick={onReject} className="px-3 border border-zinc-800 hover:border-rose-500/40 hover:text-rose-400 text-xs rounded transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function DriverActiveRide({ ride, onStart, onComplete }) {
  const canStart = ride.payment_status === "paid";

  return (
    <div className="p-6 border border-[#FFB800]/30 bg-zinc-950 rounded-md fade-up" data-testid="driver-active-ride">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#FFB800] flex items-center gap-2"><Lightning size={12} weight="fill" /> Active ride</div>
        <StatusBadge status={ride.status} />
      </div>

      <div className="space-y-3">
        <div className="text-sm">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Passenger</div>
          <div className="font-medium">{ride.passenger?.name}</div>
          <div className="text-xs text-zinc-500 font-mono-num">{ride.passenger?.phone || "—"}</div>
        </div>
        <div className="border-t border-zinc-900 pt-3 space-y-2 text-sm">
          <div className="flex gap-2"><MapPin size={14} className="text-emerald-400 mt-0.5" weight="fill" /><span>{ride.pickup}</span></div>
          <div className="flex gap-2"><Flag size={14} className="text-rose-400 mt-0.5" weight="fill" /><span>{ride.destination}</span></div>
        </div>
      </div>

      {ride.status === "accepted" && (
        <button data-testid="start-ride-button" onClick={onStart} disabled={!canStart} className="mt-5 w-full bg-[#FFB800] hover:bg-[#E5A600] text-black font-semibold py-2.5 rounded-md transition-colors flex items-center justify-center gap-2 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed">
          <Play size={14} weight="fill" /> {canStart ? "Start ride" : "Waiting for passenger payment"}
        </button>
      )}
      {ride.status === "in_progress" && (
        <button data-testid="complete-ride-button" onClick={onComplete} className="mt-5 w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-2.5 rounded-md transition-colors flex items-center justify-center gap-2">
          <CheckCircle size={14} weight="fill" /> Complete ride
        </button>
      )}
    </div>
  );
}
