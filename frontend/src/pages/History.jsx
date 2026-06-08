import React, { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { StatusBadge, SectionTitle } from "../components/Bits";
import { Star, MapPin, Flag } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function History() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/rides/mine");
        setRides(data);
      } catch (e) { toast.error(formatApiError(e)); }
    })();
  }, []);

  const filtered = filter === "all" ? rides : rides.filter((r) => r.status === filter);

  const filters = [
    { v: "all", label: "All" },
    { v: "requested", label: "Pending" },
    { v: "accepted", label: "Accepted" },
    { v: "in_progress", label: "In Progress" },
    { v: "completed", label: "Completed" },
    { v: "cancelled", label: "Cancelled" },
  ];

  return (
    <AppLayout>
      <div className="px-6 lg:px-10 py-8 max-w-6xl">
        <SectionTitle sub={`${rides.length} total · all of your rides on the platform`}>
          Ride History
        </SectionTitle>

        <div className="flex gap-2 flex-wrap mb-6">
          {filters.map((f) => (
            <button
              key={f.v}
              data-testid={`filter-${f.v}`}
              onClick={() => setFilter(f.v)}
              className={`px-3 py-1.5 rounded-md text-xs uppercase tracking-widest border transition-colors ${
                filter === f.v ? "bg-[#FFB800] text-black border-[#FFB800]" : "bg-zinc-950 text-zinc-400 border-zinc-900 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="border border-zinc-900 bg-zinc-950 rounded-md p-12 text-center text-zinc-500">No rides match this filter.</div>
        ) : (
          <div className="border border-zinc-900 bg-zinc-950 rounded-md overflow-hidden" data-testid="history-table">
            <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-zinc-900 text-[10px] uppercase tracking-[0.25em] text-zinc-500">
              <div className="col-span-4">Route</div>
              <div className="col-span-3">{user?.role === "driver" ? "Passenger" : "Driver"}</div>
              <div className="col-span-2">When</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">Rating</div>
            </div>
            {filtered.map((r) => {
              const other = user?.role === "driver" ? r.passenger : r.driver;
              return (
                <div key={r.id} className="grid grid-cols-12 gap-3 px-5 py-4 border-b border-zinc-900 last:border-0 items-center text-sm hover:bg-zinc-900/40 transition-colors">
                  <div className="col-span-4">
                    <div className="flex items-center gap-1.5 text-xs"><MapPin size={12} weight="fill" className="text-emerald-400" />{r.pickup}</div>
                    <div className="flex items-center gap-1.5 text-xs mt-1"><Flag size={12} weight="fill" className="text-rose-400" />{r.destination}</div>
                  </div>
                  <div className="col-span-3">
                    <div>{other?.name || "—"}</div>
                    {other?.vehicle_number && <div className="text-[10px] text-zinc-500 font-mono-num">{other.vehicle_number}</div>}
                  </div>
                  <div className="col-span-2 text-xs text-zinc-500 font-mono-num">{new Date(r.created_at).toLocaleString()}</div>
                  <div className="col-span-2"><StatusBadge status={r.status} /></div>
                  <div className="col-span-1 text-right">
                    {r.rating ? <span className="text-xs text-[#FFB800] flex items-center justify-end gap-1"><Star size={12} weight="fill" />{r.rating}</span> : <span className="text-xs text-zinc-600">—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
