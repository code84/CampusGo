import React, { useEffect, useState, useCallback } from "react";
import AppLayout from "../components/AppLayout";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { useSocket } from "../lib/SocketContext";
import { StatusBadge, SectionTitle } from "../components/Bits";
import { MapPin, Flag, CheckCircle, X, Lightning, Power } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function DriverInbox() {
  const { user, refreshUser } = useAuth();
  const { subscribe } = useSocket();
  const [items, setItems] = useState([]);
  const [online, setOnline] = useState(!!user?.is_online);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/rides/available");
      setItems(data);
    } catch (e) { toast.error(formatApiError(e)); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setOnline(!!user?.is_online); }, [user]);

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === "new_ride_request") {
        setItems((prev) => prev.find((r) => r.id === msg.ride.id) ? prev : [msg.ride, ...prev]);
      }
      if (msg.type === "ride_taken") {
        setItems((prev) => prev.filter((r) => r.id !== msg.ride_id));
      }
    });
    return unsub;
  }, [subscribe]);

  const toggleOnline = async () => {
    try {
      const lat = user?.lat || 29.8648;
      const lng = user?.lng || 77.8964;
      const { data } = await api.post("/drivers/availability", { is_online: !online, lat, lng });
      setOnline(data.is_online);
      toast.success(data.is_online ? "You're online" : "You went offline");
      refreshUser?.();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const accept = async (r) => {
    try {
      await api.post(`/rides/${r.id}/accept`);
      toast.success("Ride accepted — head to pickup!");
      setItems((p) => p.filter((x) => x.id !== r.id));
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const reject = async (r) => {
    try {
      await api.post(`/rides/${r.id}/reject`);
      setItems((p) => p.filter((x) => x.id !== r.id));
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <AppLayout>
      <div className="px-6 lg:px-10 py-8 max-w-5xl">
        <SectionTitle
          sub="Real-time queue of passenger requests waiting for a driver"
          action={
            <button data-testid="inbox-online-toggle" onClick={toggleOnline} className={`px-4 py-2 rounded-md text-sm font-semibold border flex items-center gap-2 transition-colors ${online ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-zinc-900 text-zinc-300 border-zinc-800"}`}>
              <Power size={14} weight={online ? "fill" : "regular"} />{online ? "Online" : "Offline"}
            </button>
          }
        >
          <span className="flex items-center gap-3">Ride Inbox {online && <span className="w-2 h-2 rounded-full bg-emerald-500 live-dot" />}</span>
        </SectionTitle>

        {!online && (
          <div className="mb-6 p-4 border border-amber-500/30 bg-amber-500/5 rounded-md text-sm text-amber-300">
            You're offline. Go online to start receiving live ride requests.
          </div>
        )}

        {items.length === 0 ? (
          <div className="border border-zinc-900 bg-zinc-950 rounded-md p-12 text-center">
            <Lightning size={28} className="text-zinc-700 mx-auto" />
            <p className="text-zinc-500 mt-3 text-sm">No pending ride requests.</p>
            <p className="text-zinc-600 text-xs mt-1">New requests will appear here instantly.</p>
            <Link to="/driver" className="inline-block mt-4 text-[#FFB800] text-xs hover:underline">← Back to dashboard</Link>
          </div>
        ) : (
          <div className="space-y-3" data-testid="inbox-list">
            {items.map((r) => (
              <div key={r.id} className="border border-zinc-900 bg-zinc-950 rounded-md p-5 fade-up">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Passenger</div>
                    <div className="font-medium">{r.passenger?.name}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex gap-2"><MapPin size={14} weight="fill" className="text-emerald-400 mt-0.5" /><div><div className="text-[10px] uppercase tracking-widest text-zinc-500">Pickup</div>{r.pickup}</div></div>
                  <div className="flex gap-2"><Flag size={14} weight="fill" className="text-rose-400 mt-0.5" /><div><div className="text-[10px] uppercase tracking-widest text-zinc-500">Destination</div>{r.destination}</div></div>
                </div>

                {r.notes && <div className="mt-3 text-xs text-zinc-500 italic">"{r.notes}"</div>}

                <div className="mt-4 flex gap-2">
                  <button data-testid={`accept-${r.id}`} onClick={() => accept(r)} className="flex-1 bg-[#FFB800] hover:bg-[#E5A600] text-black text-sm font-semibold py-2.5 rounded transition-colors flex items-center justify-center gap-2">
                    <CheckCircle size={14} weight="fill" /> Accept ride
                  </button>
                  <button data-testid={`reject-${r.id}`} onClick={() => reject(r)} className="px-4 border border-zinc-800 hover:border-rose-500/40 hover:text-rose-400 text-sm rounded transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
