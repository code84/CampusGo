import React, { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { useSocket } from "../lib/SocketContext";
import AppLayout from "../components/AppLayout";
import LiveMap from "../components/LiveMap";
import { StatCard, StatusBadge, Spinner, SectionTitle } from "../components/Bits";
import { CAMPUS_LOCATIONS, findLocation } from "../lib/locations";
import { toast } from "sonner";
import { MapPin, Flag, Star, ArrowRight, X, Calendar } from "@phosphor-icons/react";

export default function PassengerHome() {
  const { user } = useAuth();
  const { subscribe } = useSocket();
  const [pickup, setPickup] = useState("Main Gate");
  const [destination, setDestination] = useState("Lecture Hall Complex");
  const [notes, setNotes] = useState("");
  const [scheduled, setScheduled] = useState("");
  const [drivers, setDrivers] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const [{ data: d }, { data: rides }, { data: a }] = await Promise.all([
        api.get("/drivers/online"),
        api.get("/rides/mine"),
        api.get("/analytics/passenger"),
      ]);
      setDrivers(d);
      setAnalytics(a);
      const active = rides.find((r) => ["requested", "accepted", "in_progress"].includes(r.status));
      const lastCompletedNotRated = rides.find((r) => r.status === "completed" && !r.rating);
      setActiveRide(active || lastCompletedNotRated || null);
      if (lastCompletedNotRated && !active) setRateOpen(true);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === "ride_update" && msg.ride && msg.ride.passenger_id === user?.id) {
        setActiveRide(msg.ride);
        if (msg.ride.status === "accepted") toast.success("Driver accepted your ride!");
        if (msg.ride.status === "in_progress") toast.info("Your ride has started");
        if (msg.ride.status === "completed") { toast.success("Ride completed"); setRateOpen(true); }
        if (msg.ride.status === "cancelled") toast.warning("Ride was cancelled");
      }
      if (msg.type === "driver_location") {
        setDrivers((prev) => prev.map((d) => d.id === msg.driver_id ? { ...d, lat: msg.lat, lng: msg.lng } : d));
      }
      if (msg.type === "driver_availability") {
        loadAll();
      }
    });
    return unsub;
  }, [subscribe, user, loadAll]);

  const requestRide = async (e) => {
    e.preventDefault();
    const p = findLocation(pickup);
    const d = findLocation(destination);
    if (!p || !d) { toast.error("Pick valid locations"); return; }
    if (pickup === destination) { toast.error("Pickup and destination must differ"); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post("/rides/request", {
        pickup, destination,
        pickup_lat: p.lat, pickup_lng: p.lng,
        dest_lat: d.lat, dest_lng: d.lng,
        notes: notes || null,
        scheduled_for: scheduled || null,
      });
      setActiveRide(data);
      toast.success(scheduled ? "Ride scheduled" : "Searching for drivers…");
      setNotes(""); setScheduled("");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRide = async () => {
    if (!activeRide) return;
    try {
      await api.post(`/rides/${activeRide.id}/cancel`);
      toast.success("Ride cancelled");
      setActiveRide(null);
      loadAll();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const submitRating = async () => {
    if (!activeRide) return;
    try {
      await api.post(`/rides/${activeRide.id}/rate`, { rating, feedback: feedback || null });
      toast.success("Thanks for the feedback!");
      setRateOpen(false);
      setActiveRide(null);
      setRating(5); setFeedback("");
      loadAll();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const pickupLoc = findLocation(pickup);
  const destLoc = findLocation(destination);

  return (
    <AppLayout>
      <div className="px-6 lg:px-10 py-8 max-w-7xl">
        <SectionTitle sub={`Hi ${user?.name?.split(" ")[0] || "there"} · book a ride across the IIT Roorkee campus`}>
          Book a ride
        </SectionTitle>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Booking form / Active ride */}
          <div className="lg:col-span-1 space-y-6">
            {activeRide && ["requested", "accepted", "in_progress"].includes(activeRide.status) ? (
              <ActiveRideCard ride={activeRide} onCancel={cancelRide} />
            ) : (
              <form onSubmit={requestRide} className="p-6 border border-zinc-900 bg-zinc-950 rounded-md space-y-4 fade-up" data-testid="ride-request-form">
                <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">New ride</div>

                <Field icon={<MapPin size={16} className="text-emerald-400" weight="fill" />} label="Pickup">
                  <select data-testid="pickup-select" value={pickup} onChange={(e) => setPickup(e.target.value)} className={selectCls}>
                    {CAMPUS_LOCATIONS.map((l) => <option key={l.label} value={l.label}>{l.label}</option>)}
                  </select>
                </Field>
                <Field icon={<Flag size={16} className="text-rose-400" weight="fill" />} label="Destination">
                  <select data-testid="destination-select" value={destination} onChange={(e) => setDestination(e.target.value)} className={selectCls}>
                    {CAMPUS_LOCATIONS.map((l) => <option key={l.label} value={l.label}>{l.label}</option>)}
                  </select>
                </Field>
                <Field icon={<Calendar size={16} className="text-zinc-500" />} label="Schedule (optional)">
                  <input data-testid="schedule-input" type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} className={selectCls} />
                </Field>
                <Field label="Notes">
                  <textarea data-testid="notes-input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything the driver should know?" className={selectCls + " resize-none"} />
                </Field>

                <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
                  <span>Est. fare</span>
                  <span className="font-mono-num text-white">₹30</span>
                </div>

                <button data-testid="request-ride-button" disabled={submitting} className="w-full bg-[#FFB800] hover:bg-[#E5A600] text-black font-semibold py-3 rounded-md transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {submitting ? <Spinner size={16} /> : <ArrowRight size={16} weight="bold" />}
                  {scheduled ? "Schedule ride" : "Request ride now"}
                </button>
              </form>
            )}

            <div className="grid grid-cols-3 gap-3">
              <StatCard testId="stat-total" label="Total" value={analytics?.total_rides ?? "—"} />
              <StatCard testId="stat-completed" label="Done" value={analytics?.completed ?? "—"} accent="text-emerald-400" />
              <StatCard testId="stat-active" label="Active" value={analytics?.active ?? "—"} accent="text-[#FFB800]" />
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-zinc-900 bg-zinc-950 rounded-md overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-900">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Live map</div>
                  <div className="font-display font-semibold mt-0.5">{drivers.length} drivers online</div>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#FFB800]" /> Driver</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Pickup</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Dest</span>
                </div>
              </div>
              <LiveMap
                drivers={drivers}
                pickup={pickupLoc ? { ...pickupLoc, label: pickup } : null}
                destination={destLoc ? { ...destLoc, label: destination } : null}
                driverLocation={activeRide?.driver?.lat ? { lat: activeRide.driver.lat, lng: activeRide.driver.lng } : null}
                height={460}
              />
            </div>

            <div className="border border-zinc-900 bg-zinc-950 rounded-md p-6">
              <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4">Drivers online now</div>
              {drivers.length === 0 ? (
                <p className="text-zinc-500 text-sm">No drivers available right now. Try again in a moment.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3" data-testid="drivers-list">
                  {drivers.map((d) => (
                    <div key={d.id} className="flex items-center justify-between border border-zinc-900 rounded-md p-3">
                      <div>
                        <div className="font-medium">{d.name}</div>
                        <div className="text-xs text-zinc-500 font-mono-num">{d.vehicle_number}</div>
                      </div>
                      <div className="text-xs flex items-center gap-1.5 text-[#FFB800]">
                        <Star size={12} weight="fill" /> {Number(d.rating_avg).toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {rateOpen && activeRide && activeRide.status === "completed" && !activeRide.rating && (
        <RateModal
          ride={activeRide}
          rating={rating} setRating={setRating}
          feedback={feedback} setFeedback={setFeedback}
          onClose={() => setRateOpen(false)}
          onSubmit={submitRating}
        />
      )}
    </AppLayout>
  );
}

function ActiveRideCard({ ride, onCancel }) {
  return (
    <div className="p-6 border border-zinc-900 bg-zinc-950 rounded-md fade-up" data-testid="active-ride-card">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Active ride</div>
        <StatusBadge status={ride.status} />
      </div>

      <div className="space-y-3 text-sm">
        <Row label="Pickup" value={ride.pickup} dotColor="#10B981" />
        <Row label="Destination" value={ride.destination} dotColor="#EF4444" />
        {ride.driver && (
          <>
            <div className="border-t border-zinc-900 my-3" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">Your driver</div>
              <div className="font-medium">{ride.driver.name}</div>
              <div className="text-xs text-zinc-500">{ride.driver.vehicle_model} · <span className="font-mono-num">{ride.driver.vehicle_number}</span></div>
              <div className="text-xs flex items-center gap-1.5 text-[#FFB800] mt-1">
                <Star size={12} weight="fill" /> {Number(ride.driver.rating_avg || 5).toFixed(1)}
              </div>
            </div>
          </>
        )}
      </div>

      <LifecycleTrack status={ride.status} />

      <button onClick={onCancel} data-testid="cancel-ride-button" className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 border border-zinc-800 hover:border-rose-500/40 hover:text-rose-400 text-zinc-300 rounded-md text-sm transition-colors">
        <X size={14} /> Cancel ride
      </button>
    </div>
  );
}

function Row({ label, value, dotColor }) {
  return (
    <div className="flex gap-3">
      <div className="pt-1.5"><span className="block w-2 h-2 rounded-full" style={{ background: dotColor }} /></div>
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{label}</div>
        <div className="text-sm">{value}</div>
      </div>
    </div>
  );
}

function LifecycleTrack({ status }) {
  const steps = ["requested", "accepted", "in_progress", "completed"];
  const idx = steps.indexOf(status);
  return (
    <div className="mt-5">
      <div className="flex gap-1.5">
        {steps.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-[#FFB800]" : "bg-zinc-800"}`} />
        ))}
      </div>
      <div className="flex justify-between mt-2 text-[10px] uppercase tracking-widest text-zinc-500">
        <span>Booked</span><span>Accepted</span><span>En route</span><span>Done</span>
      </div>
    </div>
  );
}

function RateModal({ ride, rating, setRating, feedback, setFeedback, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" data-testid="rate-modal">
      <div className="bg-zinc-950 border border-zinc-800 rounded-md p-6 w-full max-w-md fade-up">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Rate your ride</div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>
        <h3 className="font-display font-bold text-xl">How was your ride with {ride.driver?.name || "your driver"}?</h3>
        <p className="text-sm text-zinc-500 mt-1">{ride.pickup} → {ride.destination}</p>

        <div className="flex justify-center gap-2 my-6">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} data-testid={`star-${n}`} onClick={() => setRating(n)} className="transition-transform hover:scale-110">
              <Star size={36} weight={n <= rating ? "fill" : "regular"} className={n <= rating ? "text-[#FFB800]" : "text-zinc-700"} />
            </button>
          ))}
        </div>

        <textarea data-testid="rate-feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="Optional feedback…" className={selectCls + " resize-none"} />

        <button data-testid="submit-rating" onClick={onSubmit} className="w-full mt-4 bg-[#FFB800] hover:bg-[#E5A600] text-black font-semibold py-3 rounded-md transition-colors">
          Submit
        </button>
      </div>
    </div>
  );
}

const selectCls = "w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800] focus:border-transparent";

function Field({ label, icon, children }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-1.5">{icon}{label}</label>
      {children}
    </div>
  );
}
