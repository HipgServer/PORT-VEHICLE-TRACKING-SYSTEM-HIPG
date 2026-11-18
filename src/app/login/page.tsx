"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, ShieldCheck, Compass, LogIn, AlertCircle, User, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"driver" | "admin">("driver");

  // Driver fields
  const [driverName, setDriverName] = useState("");
  const [perryNo, setPerryNo] = useState("");

  // Admin fields
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDriverLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim()) {
      setError("කරුණාකර රියදුරු නම (Driver Name) ඇතුළත් කරන්න.");
      return;
    }

    setLoading(true);
    setError("");

    try {
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

      // Store initial Perry No in sessionStorage so driver page pre-fills it
      if (perryNo.trim() && typeof window !== "undefined") {
        sessionStorage.setItem("driver_prefill_perry", perryNo.trim().toUpperCase());
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
            <span>Driver Login (රියදුරු)</span>
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
            <span>Admin Login (පරිපාලක)</span>
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
              <h3 className="font-bold text-sm text-emerald-400">රියදුරු ප්‍රවේශය (Driver Portal)</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ඔබගේ නම සහ පැවරුණු Perry අංකය ඇතුළත් කර සජීවී ට්‍රැකින් සඳහා පිවිසෙන්න.
              </p>
            </div>

            <form onSubmit={handleDriverLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Driver Name (ඔබගේ නම) *
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="උදා: Kamal Perera"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Perry No / Vehicle No (පැවරුණු Perry අංකය)
                </label>
                <div className="relative">
                  <Truck className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={perryNo}
                    onChange={(e) => setPerryNo(e.target.value)}
                    placeholder="උදා: PERI-01 හෝ TT-101"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-950 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <span>{loading ? "සම්බන්ධ වෙමින්..." : "LOGIN AS DRIVER & TRACK"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* 2. ADMINISTRATOR LOGIN FORM */}
        {activeTab === "admin" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-sky-400">පරිපාලක ප්‍රවේශය (Administrator Dashboard)</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                සම්පූර්ණ වරාය සිතියම, සියලු වාහන සහ Geofence නිරීක්ෂණය සඳහා පිවිසෙන්න.
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
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
