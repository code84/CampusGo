import React from "react";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../lib/AuthContext";
import { SectionTitle } from "../components/Bits";
import { Star, User, Car } from "@phosphor-icons/react";

export default function Profile() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <AppLayout>
      <div className="px-6 lg:px-10 py-8 max-w-3xl">
        <SectionTitle sub="Your account details">Profile</SectionTitle>

        <div className="border border-zinc-900 bg-zinc-950 rounded-md p-8">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-zinc-900 grid place-items-center border border-zinc-800">
              {user.role === "driver" ? <Car size={32} weight="duotone" className="text-[#FFB800]" /> : <User size={32} weight="duotone" className="text-[#FFB800]" />}
            </div>
            <div>
              <div className="font-display font-bold text-2xl">{user.name}</div>
              <div className="text-sm text-zinc-500">{user.email}</div>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] uppercase tracking-widest">{user.role}</div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-8">
            <Detail label="Phone" value={user.phone || "—"} />
            <Detail label="Joined" value={user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"} />
            {user.role === "driver" && (
              <>
                <Detail label="Vehicle" value={user.vehicle_model || "—"} />
                <Detail label="Reg. number" value={user.vehicle_number || "—"} mono />
                <Detail label="Rating" value={
                  <span className="flex items-center gap-1.5"><Star size={14} weight="fill" className="text-[#FFB800]" />{Number(user.rating_avg || 5).toFixed(1)} <span className="text-zinc-500 text-xs">({user.rating_count} reviews)</span></span>
                } />
                <Detail label="Status" value={
                  <span className={`inline-flex items-center gap-1.5 ${user.is_online ? "text-emerald-400" : "text-zinc-400"}`}>
                    <span className={`w-2 h-2 rounded-full ${user.is_online ? "bg-emerald-500" : "bg-zinc-600"}`} />
                    {user.is_online ? "Online" : "Offline"}
                  </span>
                } />
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Detail({ label, value, mono }) {
  return (
    <div className="border border-zinc-900 rounded-md p-4">
      <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono-num" : ""}`}>{value}</div>
    </div>
  );
}
