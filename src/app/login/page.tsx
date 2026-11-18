"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Truck, ShieldCheck, Compass, LogIn, AlertCircle, User, ArrowRight, CheckSquare } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"driver" | "admin">("driver");

  // Driver fields (auto-loaded from localStorage as default)
  const [driverName, setDriverName] = useState("");
  const [perryNo, setPerryNo] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  // Admin fields
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load saved default driver details on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("peri_saved_driver_name");
      const savedPerry = localStorage.getItem("peri_saved_perry_no");
      if (savedName) setDriverName(savedName);
      if (savedPerry) setPerryNo(savedPerry);
    }
  }, []);

  const handleDriverLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim()) {
      setError("Please enter your Driver Name.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Save details to localStorage so they are remembered as default for future logins
      if (typeof window !== "undefined") {
        if (rememberMe) {
          localStorage.setItem("peri_saved_driver_name", driverName.trim());
          if (perryNo.trim()) {
            localStorage.setItem("peri_saved_perry_no", perryNo.trim().toUpperCase());
          }
        }
        if (perryNo.trim()) {
          sessionStorage.setItem("driver_prefill_perry", perryNo.trim().toUpperCase());
        }
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginType: "driver",
          driverName: driverName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Driver sign-in failed");
      }

      router.push("/driver");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginType: "admin",
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Administrator sign-in failed");
      }

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-slate-950">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-700 flex items-center justify-center shadow-2xl shadow-sky-950">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            PERI TRACKER
          </h1>
          <p className="text-xs text-sky-400 font-mono">
            Hambantota International Port (HIPG)
          </p>
        </div>

        {/* Tab Selection: 2 Logins only */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setActiveTab("driver");
              setError("");
            }}
            className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition ${
              activeTab === "driver"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Driver Login</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("admin");
              setError("");
            }}
            className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition ${
              activeTab === "admin"
                ? "bg-sky-600 text-white shadow-lg shadow-sky-950"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Admin Login</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. DRIVER LOGIN FORM */}
        {activeTab === "driver" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-emerald-400">Driver Portal Access</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Enter your full name and assigned Perry number to begin live GPS tracking.
              </p>
            </div>

            <form onSubmit={handleDriverLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Driver Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="e.g. Johnathan Smith"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Perry No / Vehicle Identifier
                </label>
                <div className="relative">
                  <Truck className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={perryNo}
                    onChange={(e) => setPerryNo(e.target.value)}
                    placeholder="e.g. PERI-01 or TT-101"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1 pb-1">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="rememberMe" className="text-xs text-slate-300 cursor-pointer select-none">
                  Remember my details as default on this device
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-950 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <span>{loading ? "Connecting..." : "LOGIN AS DRIVER & TRACK"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-2 text-center border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("admin");
                    setError("");
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-sky-400 transition"
                >
                  Port Administrator? <span className="text-sky-400 underline underline-offset-4">Sign in to Admin Dashboard →</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2. ADMINISTRATOR LOGIN FORM */}
        {activeTab === "admin" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-sky-400">Administrator Portal</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Access the full port GIS map, fleet status, and geofence telemetry dashboard.
              </p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Admin Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-sky-950 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? "Authenticating..." : "SIGN IN AS ADMINISTRATOR"}</span>
              </button>

              <div className="pt-2 text-center border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("driver");
                    setError("");
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-emerald-400 transition"
                >
                  ← <span className="text-emerald-400 underline underline-offset-4">Back to Driver Login</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
