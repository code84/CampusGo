import React, { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { api, formatApiError } from "../lib/api";
import { SectionTitle } from "../components/Bits";
import { toast } from "sonner";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const STATUS_COLORS = {
  completed: "#10B981",
  cancelled: "#71717A",
  in_progress: "#A78BFA",
  accepted: "#3B82F6",
  requested: "#F5A524",
};

export default function DriverAnalytics() {
  const [data, setData] = useState(null);
  const [demand, setDemand] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: a }, { data: d }] = await Promise.all([
          api.get("/analytics/driver"),
          api.get("/analytics/demand"),
        ]);
        setData(a);
        setDemand(d);
      } catch (e) { toast.error(formatApiError(e)); }
    })();
  }, []);

  return (
    <AppLayout>
      <div className="px-6 lg:px-10 py-8 max-w-7xl">
        <SectionTitle sub="Your performance and campus-wide demand patterns">Analytics</SectionTitle>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card title="Completed rides · last 7 days">
            <div className="h-64">
              {data?.timeline?.length ? (
                <ResponsiveContainer>
                  <LineChart data={data.timeline}>
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

          <Card title="Status breakdown">
            <div className="h-64">
              {data?.status_breakdown?.length ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.status_breakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} stroke="#09090b" strokeWidth={3}>
                      {data.status_breakdown.map((s, i) => (
                        <Cell key={i} fill={STATUS_COLORS[s.name] || "#FFB800"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 6 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs justify-center">
              {data?.status_breakdown?.map((s) => (
                <span key={s.name} className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[s.name] || "#FFB800" }} />
                  {s.name} · <span className="font-mono-num text-white">{s.value}</span>
                </span>
              ))}
            </div>
          </Card>

          <Card title="Hourly demand · campus-wide">
            <div className="h-64">
              {demand?.hourly_demand?.length ? (
                <ResponsiveContainer>
                  <BarChart data={demand.hourly_demand}>
                    <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                    <XAxis dataKey="hour" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 6 }} />
                    <Bar dataKey="rides" fill="#FFB800" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
          </Card>

          <Card title="Top pickup points">
            <div className="space-y-2 mt-2">
              {demand?.top_pickups?.length ? demand.top_pickups.map((p, i) => {
                const max = demand.top_pickups[0]?.rides || 1;
                const pct = (p.rides / max) * 100;
                return (
                  <div key={p.location}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-zinc-300">{i + 1}. {p.location}</span>
                      <span className="font-mono-num text-zinc-500">{p.rides}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-[#FFB800]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              }) : <Empty />}
            </div>
          </Card>
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
