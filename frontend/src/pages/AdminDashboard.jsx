import React, { useEffect, useState, useCallback } from "react";
import AppLayout from "../components/AppLayout";
import { api, formatApiError } from "../lib/api";
import { StatCard, StatusBadge, SectionTitle } from "../components/Bits";
import { toast } from "sonner";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { MapPin, Flag, CheckCircle, X, User, Users, Car, Lightning } from "@phosphor-icons/react";

const STATUS_COLORS = {
  completed: "#10B981",
  cancelled: "#71717A",
  in_progress: "#A78BFA",
  accepted: "#3B82F6",
  requested: "#F5A524",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [pendingDrivers, setPendingDrivers] = useState([]);

  const load = useCallback(async () => {
    try {
      const [{ data: s }, { data: r }, { data: p }] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/recent-activity"),
        api.get("/admin/pending-drivers"),
      ]);
      setStats(s);
      setRecent(r);
      setPendingDrivers(p);
    } catch (e) { toast.error(formatApiError(e)); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approveDriver = async (driverId) => {
    try {
      await api.post(`/admin/drivers/${driverId}/approve`);
      toast.success("Driver approved");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const rejectDriver = async (driverId) => {
    const notes = prompt("Rejection reason (optional):");
    try {
      await api.post(`/admin/drivers/${driverId}/reject`, { notes: notes || null });
      toast.success("Driver rejected");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <AppLayout>
      <div className="px-6 lg:px-10 py-8 max-w-7xl">
        <SectionTitle sub="System-wide overview of the campus mobility platform">
          Admin Dashboard
        </SectionTitle>

        {/* Verification Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          <StatCard testId="stat-pending-drivers" label="Pending" value={stats?.pending_drivers ?? "—"} accent="text-[#FFB800]" />
          <StatCard testId="stat-approved-drivers" label="Approved" value={stats?.approved_drivers ?? "—"} accent="text-emerald-400" />
          <StatCard testId="stat-rejected-drivers" label="Rejected" value={stats?.rejected_drivers ?? "—"} accent="text-rose-400" />
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          <StatCard testId="stat-total-users" label="Total Users" value={stats?.total_users ?? "—"} />
          <StatCard testId="stat-total-drivers" label="Drivers" value={stats?.total_drivers ?? "—"} />
          <StatCard testId="stat-online-drivers" label="Online" value={stats?.online_drivers ?? "—"} accent="text-emerald-400" />
          <StatCard testId="stat-active-rides" label="Active" value={stats?.active_rides ?? "—"} accent="text-[#FFB800]" />
          <StatCard testId="stat-completed-rides" label="Completed" value={stats?.completed_rides ?? "—"} accent="text-emerald-400" />
          <StatCard testId="stat-cancelled-rides" label="Cancelled" value={stats?.cancelled_rides ?? "—"} accent="text-zinc-400" />
          <StatCard testId="stat-revenue" label="Revenue" value={`₹${stats?.revenue_estimate ?? 0}`} accent="text-emerald-400" sub="Est. · ₹30/ride" />
        </div>

        {/* Driver Verification Queue */}
        <div className="border border-zinc-900 bg-zinc-950 rounded-md mb-8">
          <div className="px-5 py-4 border-b border-zinc-900 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Driver Verification Queue</div>
            {pendingDrivers.length > 0 && (
              <span className="text-xs text-[#FFB800]">{pendingDrivers.length} pending</span>
            )}
          </div>
          {pendingDrivers.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-sm">
              <Users size={28} className="text-zinc-700 mx-auto mb-2" />
              No drivers awaiting verification.
            </div>
          ) : (
            <div className="divide-y divide-zinc-900">
              {pendingDrivers.map((d) => (
                <div key={d.id} className="grid grid-cols-12 gap-3 px-5 py-4 items-center text-sm hover:bg-zinc-900/40 transition-colors">
                  <div className="col-span-2">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-zinc-500">{d.email}</div>
                  </div>
                  <div className="col-span-3 text-xs">
                    <div><span className="text-zinc-500">Vehicle:</span> {d.vehicle_model} · {d.vehicle_number}</div>
                    <div><span className="text-zinc-500">License:</span> {d.license_number || "—"}</div>
                  </div>
                  <div className="col-span-3 text-xs">
                    <div><span className="text-zinc-500">College ID:</span> {d.college_id || "—"}</div>
                    <div><span className="text-zinc-500">Phone:</span> {d.phone || "—"}</div>
                  </div>
                  <div className="col-span-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest border bg-amber-500/10 text-amber-400 border-amber-500/30 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Pending
                    </span>
                  </div>
                  <div className="col-span-2 flex gap-2 justify-end">
                    <button
                      data-testid={`approve-driver-${d.id}`}
                      onClick={() => approveDriver(d.id)}
                      className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <CheckCircle size={12} weight="fill" /> Approve
                    </button>
                    <button
                      data-testid={`reject-driver-${d.id}`}
                      onClick={() => rejectDriver(d.id)}
                      className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <X size={12} weight="bold" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card title="Ride Status Distribution">
            <div className="h-64">
              {stats?.status_breakdown?.length ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={stats.status_breakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} stroke="#09090b" strokeWidth={3}>
                      {stats.status_breakdown.map((s, i) => (
                        <Cell key={i} fill={STATUS_COLORS[s.name] || "#FFB800"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 6 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs justify-center">
              {stats?.status_breakdown?.map((s) => (
                <span key={s.name} className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[s.name] || "#FFB800" }} />
                  {s.name} · <span className="font-mono-num text-white">{s.value}</span>
                </span>
              ))}
            </div>
          </Card>

          <Card title="Daily Ride Trend (Last 7 Days)">
            <div className="h-64">
              {stats?.daily_trend?.length ? (
                <ResponsiveContainer>
                  <LineChart data={stats.daily_trend}>
                    <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                    <XAxis dataKey="day" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 6 }} />
                    <Line type="monotone" dataKey="rides" stroke="#FFB800" strokeWidth={2.5} dot={{ fill: "#FFB800", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
          </Card>
        </div>

        {/* Recent activity */}
        <div className="border border-zinc-900 bg-zinc-950 rounded-md">
          <div className="px-5 py-4 border-b border-zinc-900">
            <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Recent activity</div>
          </div>
          {recent.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-sm">No recent activity.</div>
          ) : (
            <div className="divide-y divide-zinc-900">
              {recent.map((r) => (
                <div key={r.id} className="grid grid-cols-12 gap-3 px-5 py-4 items-center text-sm hover:bg-zinc-900/40 transition-colors">
                  <div className="col-span-1">
                    {r.status === "completed" ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 block mx-auto" />
                    ) : r.status === "cancelled" ? (
                      <span className="w-2 h-2 rounded-full bg-zinc-600 block mx-auto" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[#FFB800] block mx-auto" />
                    )}
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-center gap-1.5 text-xs">
                      <MapPin size={12} weight="fill" className="text-emerald-400" />{r.pickup}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs mt-1">
                      <Flag size={12} weight="fill" className="text-rose-400" />{r.destination}
                    </div>
                  </div>
                  <div className="col-span-2 text-xs">
                    <div>{r.passenger?.name || "—"}</div>
                  </div>
                  <div className="col-span-2 text-xs">
                    <div>{r.driver?.name || "—"}</div>
                  </div>
                  <div className="col-span-2 text-xs text-zinc-500 font-mono-num">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                  <div className="col-span-2 text-right">
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function Card({ title, children }) {
  return (
    <div className="border border-zinc-900 bg-zinc-950 rounded-md p-5">
      <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4">{title}</div>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="h-full grid place-items-center text-zinc-600 text-sm">No data yet</div>;
}
