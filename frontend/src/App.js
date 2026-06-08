import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import "./App.css";

import { AuthProvider, useAuth } from "./lib/AuthContext";
import { SocketProvider } from "./lib/SocketContext";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PassengerHome from "./pages/PassengerHome";
import DriverDashboard from "./pages/DriverDashboard";
import DriverInbox from "./pages/DriverInbox";
import DriverAnalytics from "./pages/DriverAnalytics";
import History from "./pages/History";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import Notifications from "./pages/Notifications";

function FullPageLoader() {
  return (
    <div className="min-h-screen bg-[#09090b] grid place-items-center">
      <div className="text-zinc-500 text-sm uppercase tracking-[0.3em]">Loading…</div>
    </div>
  );
}

function Protected({ children, roles }) {
  const { user } = useAuth();
  if (user === undefined) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    const fallback = user.role === "driver" ? "/driver" : user.role === "admin" ? "/admin" : "/passenger";
    return <Navigate to={fallback} replace />;
  }
  return children;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <FullPageLoader />;
  if (user) {
    const home = user.role === "driver" ? "/driver" : user.role === "admin" ? "/admin" : "/passenger";
    return <Navigate to={home} replace />;
  }
  return children;
}

function RoleRedirect() {
  const { user } = useAuth();
  if (user === undefined) return <FullPageLoader />;
  if (!user) return <Landing />;
  const home = user.role === "driver" ? "/driver" : user.role === "admin" ? "/admin" : "/passenger";
  return <Navigate to={home} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Toaster
            position="top-right"
            theme="dark"
            toastOptions={{
              style: { background: "#18181b", color: "#fafafa", border: "1px solid #27272a" },
            }}
          />
          <Routes>
            <Route path="/" element={<RoleRedirect />} />
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />

            <Route path="/passenger" element={<Protected roles={["passenger"]}><PassengerHome /></Protected>} />
            <Route path="/driver" element={<Protected roles={["driver"]}><DriverDashboard /></Protected>} />
            <Route path="/driver/inbox" element={<Protected roles={["driver"]}><DriverInbox /></Protected>} />
            <Route path="/driver/analytics" element={<Protected roles={["driver"]}><DriverAnalytics /></Protected>} />

            <Route path="/admin" element={<Protected roles={["admin"]}><AdminDashboard /></Protected>} />

            <Route path="/history" element={<Protected><History /></Protected>} />
            <Route path="/profile" element={<Protected><Profile /></Protected>} />
            <Route path="/notifications" element={<Protected><Notifications /></Protected>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
