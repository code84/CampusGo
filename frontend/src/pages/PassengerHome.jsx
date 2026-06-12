import React, { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { useSocket } from "../lib/SocketContext";
import AppLayout from "../components/AppLayout";
import LiveMap from "../components/LiveMap";
import { StatCard, StatusBadge, Spinner, SectionTitle } from "../components/Bits";
import { CAMPUS_LOCATIONS, findLocation } from "../lib/locations";
import { toast } from "sonner";
import { MapPin, Flag, Star, ArrowRight, X, Calendar, CreditCard } from "@phosphor-icons/react";

const RIDE_FARE_INR = 30;
const RAZORPAY_CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existingScript = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_SCRIPT}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true), { once: true });
      existingScript.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SCRIPT;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function openRazorpayCheckout({ amountInRupees, user, pickup, destination }) {
  const key = process.env.REACT_APP_RAZORPAY_KEY_ID;
  if (!key) {
    throw new Error("Add REACT_APP_RAZORPAY_KEY_ID in frontend/.env to enable Razorpay test checkout.");
  }

  const isLoaded = await loadRazorpayCheckout();
  if (!isLoaded || !window.Razorpay) {
    throw new Error("Unable to load Razorpay checkout. Check your internet connection and try again.");
  }

  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key,
      amount: amountInRupees * 100,
      currency: "INR",
      name: "CampusGo",
      description: `Campus ride: ${pickup} to ${destination}`,
      prefill: {
        name: user?.name || "",
        email: user?.email || "",
        contact: user?.phone || "",
      },
      notes: {
        pickup,
        destination,
        mode: "test",
      },
      theme: { color: "#FFB800" },
      handler: resolve,
      modal: {
        ondismiss: () => reject(new Error("Payment was cancelled.")),
      },
    });

    checkout.on("payment.failed", (response) => {
      reject(new Error(response?.error?.description || "Payment failed. Please try again."));
    });

    checkout.open();
  });
}

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
  const [paying, setPaying] = useState(false);
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
        if (msg.ride.status === "completed") toast.success("Ride completed");
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

  const payForRide = async () => {
    if (!activeRide || activeRide.status !== "accepted") return;
    const amount = activeRide.fare_estimate || RIDE_FARE_INR;
    setPaying(true);
    try {
      const payment = await openRazorpayCheckout({ amountInRupees: amount, user, pickup: activeRide.pickup, destination: activeRide.destination });
      const { data } = await api.post(`/rides/${activeRide.id}/payment`, {
        fare_amount: amount,
        payment_id: payment.razorpay_payment_id,
        payment_status: "paid",
      });
      setActiveRide(data);
      toast.success("Payment successful. Ride can start now.");
      loadAll();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setPaying(false); }
  };

  const submitRating = async () => {
    if (!activeRide) return;
    try {
      await api.post(`/rides/${activeRide.id}/rate`, { rating, feedback: feedback || null });
      toast.success("Thanks for the feedback!");
      setActiveRide(null);
      setRating(5); setFeedback("");
      loadAll();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const pickupLoc = findLocation(pickup);
  const destLoc = findLocation(destination);
  const showFeedbackForm = activeRide?.status === "completed" && !activeRide.rating;

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
              <ActiveRideCard ride={activeRide} onCancel={cancelRide} onPay={payForRide} paying={paying} />
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
                  <span className="font-mono-num text-white">₹{RIDE_FARE_INR}</span>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-zinc-900 bg-black/30 px-3 py-2 text-xs text-zinc-400">
                  <CreditCard size={15} className="text-[#FFB800]" />
                  Pay after your driver accepts the ride.
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

            {showFeedbackForm && (
              <FeedbackCard
                ride={activeRide}
                rating={rating}
                setRating={setRating}
                feedback={feedback}
                setFeedback={setFeedback}
                onSubmit={submitRating}
              />
            )}

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

    </AppLayout>
  );
}

function ActiveRideCard({ ride, onCancel, onPay, paying }) {
  const needsPayment = ride.status === "accepted" && ride.payment_status !== "paid";
  const isPaid = ride.payment_status === "paid";

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

      {needsPayment && (
        <button type="button" onClick={onPay} disabled={paying} data-testid="pay-ride-button" className="mt-3 w-full bg-[#FFB800] hover:bg-[#E5A600] text-black font-semibold py-2.5 rounded-md transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {paying ? <Spinner size={14} /> : <CreditCard size={14} weight="fill" />}
          Pay ₹{ride.fare_estimate || RIDE_FARE_INR} to start ride
        </button>
      )}

      {isPaid && ride.status === "accepted" && (
        <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          Payment complete. Your driver can start the ride now.
        </div>
      )}
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

function FeedbackCard({ ride, rating, setRating, feedback, setFeedback, onSubmit }) {
  const routeLabel = `${ride.pickup} to ${ride.destination}`;

  return (
    <div className="relative overflow-hidden border border-[#FFB800]/30 bg-[#FFB800]/5 rounded-md p-6 fade-up" data-testid="rate-modal">
      <div className="absolute inset-y-0 right-0 w-40 bg-[#FFB800]/10 blur-3xl" />
      <div className="relative grid lg:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-emerald-300">
            Ride completed
          </div>
          <h3 className="font-display font-bold text-2xl mt-4">Share your ride feedback</h3>
          <p className="text-sm text-zinc-400 mt-2">
            Help us keep CampusGo reliable. Rate {ride.driver?.name || "your driver"} for the trip from {routeLabel}.
          </p>

          <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
            <div className="border border-zinc-800 bg-black/30 rounded-md p-3">
              <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Pickup</div>
              <div className="mt-1 text-white">{ride.pickup}</div>
            </div>
            <div className="border border-zinc-800 bg-black/30 rounded-md p-3">
              <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Destination</div>
              <div className="mt-1 text-white">{ride.destination}</div>
            </div>
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-950/90 rounded-md p-4 min-w-80">
          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-3">Your rating</div>
          <div className="flex justify-between gap-2 mb-4" role="group" aria-label="Ride rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" data-testid={`star-${n}`} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)} className="rounded-md p-1.5 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#FFB800]">
                <Star size={34} weight={n <= rating ? "fill" : "regular"} className={n <= rating ? "text-[#FFB800]" : "text-zinc-700"} />
              </button>
            ))}
          </div>

          <textarea data-testid="rate-feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} placeholder="What went well? Anything we should improve?" className={selectCls + " resize-none"} />

          <button type="button" data-testid="submit-rating" onClick={onSubmit} className="w-full mt-4 bg-[#FFB800] hover:bg-[#E5A600] text-black font-semibold py-3 rounded-md transition-colors">
            Submit feedback
          </button>
        </div>
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
