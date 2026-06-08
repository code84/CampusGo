import React, { useEffect, useState, useCallback } from "react";
import AppLayout from "../components/AppLayout";
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, formatApiError } from "../lib/api";
import { useSocket } from "../lib/SocketContext";
import { SectionTitle } from "../components/Bits";
import { Bell, Check, CheckCircle } from "@phosphor-icons/react";
import { toast } from "sonner";

const TYPE_LABELS = {
  ride_requested: "Ride Requested",
  ride_accepted: "Ride Accepted",
  ride_started: "Ride Started",
  ride_completed: "Ride Completed",
  ride_cancelled: "Ride Cancelled",
  new_rating: "New Rating",
  driver_verified: "Verified",
  driver_rejected: "Rejected",
};

export default function Notifications() {
  const [notifs, setNotifs] = useState([]);
  const { subscribe } = useSocket() || {};

  const load = useCallback(async () => {
    try {
      const data = await fetchNotifications();
      setNotifs(data);
    } catch (e) { toast.error(formatApiError(e)); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!subscribe) return;
    return subscribe((msg) => {
      if (msg.type === "notification") {
        setNotifs((prev) => [msg.notification, ...prev]);
      }
    });
  }, [subscribe]);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const unread = notifs.filter((n) => !n.read).length;

  return (
    <AppLayout>
      <div className="px-6 lg:px-10 py-8 max-w-6xl">
        <SectionTitle
          sub={`${notifs.length} total · ${unread} unread`}
          action={
            unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs uppercase tracking-widest border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
              >
                <CheckCircle size={14} /> Mark all read
              </button>
            )
          }
        >
          Notifications
        </SectionTitle>

        {notifs.length === 0 ? (
          <div className="border border-zinc-900 bg-zinc-950 rounded-md p-12 text-center text-zinc-500">
            <Bell size={32} className="mx-auto mb-3 opacity-30" />
            No notifications yet.
          </div>
        ) : (
          <div className="space-y-2">
            {notifs.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.read && handleMarkRead(n.id)}
                className={`flex items-start gap-4 px-5 py-4 rounded-md border transition-colors cursor-pointer ${
                  n.read
                    ? "bg-zinc-950 border-zinc-900 opacity-60"
                    : "bg-zinc-900/60 border-zinc-800 hover:bg-zinc-900"
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {n.read ? (
                    <Check size={16} className="text-zinc-600" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-[#FFB800]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium uppercase tracking-widest text-zinc-300">
                      {TYPE_LABELS[n.type] || n.title}
                    </span>
                    <span className="text-[10px] text-zinc-600 font-mono-num">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-400">{n.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
