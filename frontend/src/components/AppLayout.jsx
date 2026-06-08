import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useSocket } from "../lib/SocketContext";
import { fetchUnreadCount, fetchNotifications, markNotificationRead } from "../lib/api";
import { SignOut, MapTrifold, ChartBar, ClockCounterClockwise, Car, User, Lightning, Bell } from "@phosphor-icons/react";

const NAV_PASSENGER = [
  { to: "/passenger", label: "Book Ride", icon: MapTrifold },
  { to: "/history", label: "History", icon: ClockCounterClockwise },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

const NAV_DRIVER = [
  { to: "/driver", label: "Dashboard", icon: Car },
  { to: "/driver/inbox", label: "Ride Inbox", icon: Lightning },
  { to: "/driver/analytics", label: "Analytics", icon: ChartBar },
  { to: "/history", label: "History", icon: ClockCounterClockwise },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

const NAV_ADMIN = [
  { to: "/admin", label: "Dashboard", icon: ChartBar },
  { to: "/history", label: "History", icon: ClockCounterClockwise },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const { connected, subscribe } = useSocket();
  const location = useLocation();
  const nav = useNavigate();
  const NAV_MAP = { driver: NAV_DRIVER, admin: NAV_ADMIN };
  const items = NAV_MAP[user?.role] || NAV_PASSENGER;
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [recentNotifs, setRecentNotifs] = useState([]);
  const dropdownRef = useRef(null);

  const refreshUnread = useCallback(async () => {
    try { setUnreadCount(await fetchUnreadCount()); } catch (_) {}
  }, []);

  useEffect(() => { refreshUnread(); }, [refreshUnread]);

  useEffect(() => {
    if (!subscribe) return;
    return subscribe((msg) => {
      if (msg.type === "notification") {
        setUnreadCount((c) => c + 1);
        setRecentNotifs((prev) => [msg.notification, ...prev].slice(0, 5));
      }
    });
  }, [subscribe]);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleBellClick = async () => {
    if (dropdownOpen) {
      setDropdownOpen(false);
      return;
    }
    try {
      const data = await fetchNotifications();
      setRecentNotifs(data.slice(0, 5));
    } catch (_) {}
    setDropdownOpen(true);
  };

  const handleNotifClick = async (n) => {
    if (!n.read) {
      try {
        await markNotificationRead(n.id);
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (_) {}
    }
    nav("/notifications");
    setDropdownOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-zinc-900 bg-[#0a0a0c] sticky top-0 h-screen">
        <div className="px-6 py-6 border-b border-zinc-900">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-link">
            <div className="w-9 h-9 rounded-md bg-[#FFB800] grid place-items-center">
              <Lightning weight="fill" size={20} color="#000" />
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-none">CampusGo</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-1">IIT Roorkee</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-zinc-900 text-white border border-zinc-800"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                }`}
              >
                <Icon size={18} weight={active ? "fill" : "regular"} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-zinc-900 space-y-3">
          <div className="flex items-center justify-between px-3 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 live-dot" : "bg-zinc-600"}`} />
              <span className="text-zinc-500 uppercase tracking-widest">{connected ? "Live" : "Offline"}</span>
            </div>
            <div className="relative" ref={dropdownRef}>
              <button
                data-testid="notification-bell"
                onClick={handleBellClick}
                className="relative p-1.5 rounded-md hover:bg-zinc-900 transition-colors"
              >
                <Bell size={16} className="text-zinc-400" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#FFB800] text-black text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {dropdownOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-72 bg-zinc-900 border border-zinc-800 rounded-md shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-2.5 border-b border-zinc-800 text-[10px] uppercase tracking-widest text-zinc-500">
                    Recent Notifications
                  </div>
                  {recentNotifs.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-zinc-600">No notifications yet</div>
                  ) : (
                    recentNotifs.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`w-full text-left px-4 py-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/60 transition-colors ${
                          n.read ? "" : "border-l-2 border-l-[#FFB800]"
                        }`}
                      >
                        <div className="text-xs font-medium text-zinc-200">{n.title}</div>
                        <div className="text-[11px] text-zinc-500 truncate mt-0.5">{n.message}</div>
                      </button>
                    ))
                  )}
                  <Link
                    to="/notifications"
                    onClick={() => setDropdownOpen(false)}
                    className="block px-4 py-2.5 text-center text-xs uppercase tracking-widest text-zinc-400 hover:text-white border-t border-zinc-800 transition-colors"
                  >
                    View All
                  </Link>
                </div>
              )}
            </div>
          </div>
          <div className="px-3">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="text-xs text-zinc-500 truncate">{user?.email}</div>
          </div>
          <button
            data-testid="logout-button"
            onClick={async () => { await logout(); nav("/login"); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs uppercase tracking-widest text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded-md transition-colors"
          >
            <SignOut size={14} />
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-[#FFB800] grid place-items-center">
              <Lightning weight="fill" size={16} color="#000" />
            </div>
            <span className="font-display font-bold">CampusGo</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 live-dot" : "bg-zinc-600"}`} />
            <Link
              to="/notifications"
              className="relative p-1 rounded-md hover:bg-zinc-900 transition-colors"
            >
              <Bell size={16} className="text-zinc-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#FFB800] text-black text-[8px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            <button data-testid="mobile-logout" onClick={async () => { await logout(); nav("/login"); }} className="text-xs text-zinc-400">
              <SignOut size={18} />
            </button>
          </div>
        </div>
        <div className="flex overflow-x-auto px-2 pb-2 gap-1">
          {items.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs ${active ? "bg-zinc-800 text-white" : "text-zinc-400"}`}
              >
                <Icon size={14} /> {label}
              </Link>
            );
          })}
        </div>
      </header>

      <main className="flex-1 min-w-0 pt-24 md:pt-0">
        {children}
      </main>
    </div>
  );
}
