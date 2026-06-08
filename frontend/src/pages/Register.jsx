import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { Lightning, Car, User as UserIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get("role") === "driver" ? "driver" : "passenger");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    vehicle_model: "Mahindra Treo E-Rickshaw",
    vehicle_number: "",
    license_number: "",
    college_id: "",
  });
  const [loading, setLoading] = useState(false);

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await register({ ...form, role });
      toast.success(`Welcome, ${user.name}`);
      nav(role === "driver" ? "/driver" : "/passenger", { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#09090b] text-white">
      <div className="hidden lg:block relative overflow-hidden">
        <img src="https://images.unsplash.com/photo-1624196639293-b04b44d39b59" className="absolute inset-0 w-full h-full object-cover" alt="" />
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950/85 via-zinc-950/55 to-zinc-950/95" />
        <div className="relative z-10 p-12 flex flex-col h-full">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-md bg-[#FFB800] grid place-items-center">
              <Lightning weight="fill" size={22} color="#000" />
            </div>
            <div>
              <div className="font-display font-bold text-xl leading-none">CampusGo</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-400 mt-1">Create account</div>
            </div>
          </Link>
          <div className="mt-auto">
            <h2 className="font-display font-bold text-4xl leading-tight max-w-md">Join the campus mobility grid.</h2>
            <p className="text-zinc-400 mt-3 max-w-md">Two roles, one platform. Book rides as a passenger, or accept dispatches as a driver.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-md fade-up">
          <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">Create account</div>
          <h1 className="font-display font-bold text-3xl tracking-tight">Get started.</h1>

          <div className="mt-6 grid grid-cols-2 gap-2 p-1 bg-zinc-950 border border-zinc-900 rounded-md">
            <button
              type="button"
              data-testid="role-passenger"
              onClick={() => setRole("passenger")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded text-sm font-medium transition-colors ${role === "passenger" ? "bg-[#FFB800] text-black" : "text-zinc-400 hover:text-white"}`}
            >
              <UserIcon size={16} weight={role === "passenger" ? "fill" : "regular"} /> Passenger
            </button>
            <button
              type="button"
              data-testid="role-driver"
              onClick={() => setRole("driver")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded text-sm font-medium transition-colors ${role === "driver" ? "bg-[#FFB800] text-black" : "text-zinc-400 hover:text-white"}`}
            >
              <Car size={16} weight={role === "driver" ? "fill" : "regular"} /> Driver
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="Full name">
              <input data-testid="register-name" required value={form.name} onChange={(e) => setF("name", e.target.value)} className={inputCls} placeholder="Aarav Sharma" />
            </Field>
            <Field label="Email">
              <input data-testid="register-email" type="email" required value={form.email} onChange={(e) => setF("email", e.target.value)} className={inputCls} placeholder="you@iitr.ac.in" />
            </Field>
            <Field label="Phone">
              <input data-testid="register-phone" value={form.phone} onChange={(e) => setF("phone", e.target.value)} className={inputCls} placeholder="+91 9000000000" />
            </Field>
            <Field label="Password">
              <input data-testid="register-password" type="password" required minLength={6} value={form.password} onChange={(e) => setF("password", e.target.value)} className={inputCls} placeholder="At least 6 characters" />
            </Field>

            {role === "driver" && (
              <>
                <Field label="Vehicle model">
                  <input data-testid="register-vehicle-model" value={form.vehicle_model} onChange={(e) => setF("vehicle_model", e.target.value)} className={inputCls} placeholder="Mahindra Treo E-Rickshaw" />
                </Field>
                <Field label="Vehicle number">
                  <input data-testid="register-vehicle-number" required value={form.vehicle_number} onChange={(e) => setF("vehicle_number", e.target.value)} className={inputCls} placeholder="UK07 AB 1234" />
                </Field>
                <Field label="License number">
                  <input data-testid="register-license-number" required value={form.license_number} onChange={(e) => setF("license_number", e.target.value)} className={inputCls} placeholder="DL-07202500001" />
                </Field>
                <Field label="College ID">
                  <input data-testid="register-college-id" required value={form.college_id} onChange={(e) => setF("college_id", e.target.value)} className={inputCls} placeholder="IITR2024001" />
                </Field>
              </>
            )}

            <button data-testid="register-submit" disabled={loading} className="w-full bg-[#FFB800] hover:bg-[#E5A600] text-black font-semibold py-3 rounded-md transition-colors disabled:opacity-60">
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="text-sm text-zinc-500 mt-6 text-center">
            Already have an account? <Link to="/login" className="text-[#FFB800] hover:underline" data-testid="register-go-login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full bg-zinc-900 border border-zinc-800 rounded-md px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#FFB800] focus:border-transparent text-sm";

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-zinc-400 mb-2 block">{label}</label>
      {children}
    </div>
  );
}
