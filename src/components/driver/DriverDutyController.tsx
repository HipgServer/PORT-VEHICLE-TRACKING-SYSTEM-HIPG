"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { GPSTrackingEngine } from "@/lib/gps/engine";
import { TrackingStatus, IQueuedGpsRecord } from "@/lib/types";
import {
  Play,
  Square,
  Navigation,
  Gauge,
  Compass,
  AlertTriangle,
  Database,
  Truck,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  MapPin,
  MapPinOff,
  LogOut,
  ShieldCheck,
  User,
} from "lucide-react";

interface DriverDutyControllerProps {
  driverId: string;
  driverName: string;
  initialDutySession: any;
  availableVehicles: Array<{ id: string; vehicleNumber: string; type: string; makeModel: string }>;
}

export function DriverDutyController({
  driverId,
  driverName: initialDriverName,
  initialDutySession,
  availableVehicles,
}: DriverDutyControllerProps) {
  const router = useRouter();

  // Inputs
  const [driverName, setDriverName] = useState<string>(initialDriverName || "");
  const [perryNo, setPerryNo] = useState<string>(
    initialDutySession?.vehicleId?.vehicleNumber || ""
  );

  // Connectivity & Permission Statuses
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [hasGpsPermission, setHasGpsPermission] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState<string>("");

  // Duty & Tracking State
  const [activeSession, setActiveSession] = useState<any>(initialDutySession);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>(
    initialDutySession ? "TRACKING_ACTIVE" : "DUTY_ENDED"
  );
  const [lastSample, setLastSample] = useState<IQueuedGpsRecord | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const engineRef = useRef<GPSTrackingEngine | null>(null);

  // 1. Pre-fill Perry No from sessionStorage if passed from login
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedPerry = sessionStorage.getItem("driver_prefill_perry");
      if (storedPerry && !perryNo) {
        setPerryNo(storedPerry);
      }
    }
  }, []);

  // 2. Check Network and GPS Readiness
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);

      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // Check GPS Permission state
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions
          .query({ name: "geolocation" as any })
          .then((status) => {
            setHasGpsPermission(status.state === "granted");
            status.onchange = () => {
              setHasGpsPermission(status.state === "granted");
            };
          })
          .catch(() => {
            setHasGpsPermission(null);
          });
      }

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  // 3. Auto-start tracking if active duty session already exists
  useEffect(() => {
    if (activeSession && (activeSession.status === "DUTY_ACTIVE" || activeSession.status === "DUTY_INTERRUPTED")) {
      const vId = activeSession.vehicleId?._id || activeSession.vehicleId;
      startTrackingEngine(vId, activeSession._id);
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
        engineRef.current = null;
      }
    };
  }, []);

  const requestGpsPermission = () => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      setPermissionError("");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setHasGpsPermission(true);
          setPermissionError("");
        },
        (err) => {
          setHasGpsPermission(false);
          setPermissionError(
            err.code === 1
              ? "Location permission was denied. Please allow location access in your browser settings."
              : "Could not obtain GPS fix. Please ensure Phone GPS/Location is turned ON."
          );
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setPermissionError("Geolocation is not supported by your mobile browser.");
    }
  };

  const startTrackingEngine = (vehicleId: string, dutySessionId: string) => {
    if (engineRef.current) {
      engineRef.current.stop();
    }

    const engine = new GPSTrackingEngine({
      vehicleId,
      driverId,
      dutySessionId,
      onStatusChange: (status) => {
        setTrackingStatus(status);
      },
      onLocationSampled: (record) => {
        setLastSample(record);
      },
      onPendingQueueCountChange: (count) => {
        setPendingCount(count);
      },
    });

    engine.start();
    engineRef.current = engine;
  };

  const handleStartDuty = async () => {
    if (!perryNo.trim()) {
      setErrorMsg("කරුණාකර Perry අංකය (Perry No) ඇතුළත් කරන්න.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      // Obtain GPS coordinates
      let lat = parseFloat(process.env.NEXT_PUBLIC_DEFAULT_LAT || "6.1235");
      let lng = parseFloat(process.env.NEXT_PUBLIC_DEFAULT_LNG || "81.0940");

      if (navigator.geolocation) {
        try {
          const pos: GeolocationPosition = await new Promise((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, {
              enableHighAccuracy: true,
              timeout: 6000,
            })
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          setHasGpsPermission(true);
        } catch (e: any) {
          console.warn("Using fallback coordinate while acquiring hardware fix:", e);
        }
      }

      const res = await fetch("/api/duty/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perryNo: perryNo.trim().toUpperCase(),
          driverName: driverName.trim(),
          latitude: lat,
          longitude: lng,
          forceRestart: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start duty tracking");
      }

      setActiveSession(data.dutySession);
      const vehicleId = data.vehicle?.id || data.dutySession?.vehicleId;
      startTrackingEngine(vehicleId, data.dutySession._id);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopAndLogout = async () => {
    if (!confirm("ඔබට සැබවින්ම ට්‍රැකින් නවතා Log Out වීමට අවශ්‍යද?")) return;

    setIsLoading(true);
    setErrorMsg("");

    try {
      if (engineRef.current) {
        engineRef.current.stop();
        engineRef.current = null;
      }

      if (activeSession) {
        await fetch("/api/duty/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dutySessionId: activeSession._id,
            latitude: lastSample?.latitude,
            longitude: lastSample?.longitude,
          }),
        });
      }

      // Logout and redirect to login
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isOnDuty = activeSession && activeSession.status !== "DUTY_COMPLETED";

  return (
    <div className="max-w-md mx-auto w-full space-y-4">
      {/* Driver Header Badge */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-emerald-400">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Port Driver</span>
            <h2 className="text-base font-extrabold text-white leading-tight">
              {driverName || "Driver"}
            </h2>
          </div>
        </div>

        <div className="text-right">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
              isOnDuty
                ? "bg-emerald-950 text-emerald-400 border border-emerald-700 animate-pulse"
                : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
          >
            {isOnDuty ? "● ON DUTY" : "○ OFF DUTY"}
          </span>
        </div>
      </div>

      {/* STEP 1: READINESS CHECKLIST (Data ON & Location ON) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
        <span className="text-[10px] font-extrabold text-sky-400 uppercase tracking-wider block">
          පූර්ව පරීක්ෂාව (System Readiness Checks)
        </span>

        <div className="space-y-2">
          {/* Mobile Data / Internet Status */}
          <div className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
            <div className="flex items-center space-x-2.5">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-emerald-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-rose-400" />
              )}
              <span className="font-semibold text-slate-200">Mobile Data / Internet</span>
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isOnline
                  ? "bg-emerald-950 text-emerald-400"
                  : "bg-rose-950 text-rose-400 border border-rose-800 animate-pulse"
              }`}
            >
              {isOnline ? "Connected (On)" : "Offline (Data On කරන්න)"}
            </span>
          </div>

          {/* GPS Location Permission Status */}
          <div className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
            <div className="flex items-center space-x-2.5">
              {hasGpsPermission ? (
                <MapPin className="w-4 h-4 text-emerald-400" />
              ) : (
                <MapPinOff className="w-4 h-4 text-amber-400" />
              )}
              <span className="font-semibold text-slate-200">Phone GPS / Location</span>
            </div>

            {hasGpsPermission ? (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400">
                Location Active
              </span>
            ) : (
              <button
                type="button"
                onClick={requestGpsPermission}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow transition"
              >
                Enable Location Permission
              </button>
            )}
          </div>
        </div>

        {permissionError && (
          <p className="text-[11px] text-rose-400 bg-rose-950/40 p-2 rounded-lg border border-rose-900">
            {permissionError}
          </p>
        )}
      </div>

      {errorMsg && (
        <div className="bg-rose-950/80 border border-rose-800 text-rose-200 p-3 rounded-xl text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 2: INPUTS & CONTROLS */}
      {!isOnDuty ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="font-bold text-sm text-white">වාහන තොරතුරු ඇතුළත් කරන්න</h3>
            <p className="text-[11px] text-slate-400">
              Enter your assigned Perry number to connect live tracking.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Perry No / Vehicle No (Perry අංකය) *
              </label>
              <div className="relative">
                <Truck className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={perryNo}
                  onChange={(e) => setPerryNo(e.target.value.toUpperCase())}
                  placeholder="උදා: PERI-01 හෝ TT-101"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white uppercase placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Quick suggestions if available */}
              {availableVehicles.length > 0 && (
                <div className="flex items-center space-x-1.5 mt-2 overflow-x-auto pb-1">
                  <span className="text-[10px] text-slate-500 shrink-0">Quick:</span>
                  {availableVehicles.slice(0, 4).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setPerryNo(v.vehicleNumber)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 shrink-0"
                    >
                      {v.vehicleNumber}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Driver Name (රියදුරු නම) *
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Kamal Perera"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartDuty}
              disabled={isLoading || !perryNo.trim()}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-base shadow-xl shadow-emerald-950 flex items-center justify-center space-x-2 transition disabled:opacity-50 mt-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{isLoading ? "Starting Tracking..." : "START TRACKING (ට්‍රැකින් අරඹන්න)"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* STEP 3: ACTIVE TRACKING STATE */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Current Equipment</span>
              <h3 className="text-xl font-black text-sky-400">
                {activeSession.vehicleId?.vehicleNumber || perryNo}
              </h3>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1" />
              <span>LIVE TRACKING ACTIVE</span>
            </span>
          </div>

          {/* Real-time Telemetry Tiles */}
          <div className="grid grid-cols-2 gap-2 text-white">
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-800">
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs mb-1">
                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                <span>Speed</span>
              </div>
              <p className="text-xl font-bold">
                {lastSample ? `${(lastSample.speed || 0).toFixed(1)} km/h` : "0.0 km/h"}
              </p>
            </div>

            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-800">
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs mb-1">
                <Navigation className="w-3.5 h-3.5 text-sky-400" />
                <span>GPS Accuracy</span>
              </div>
              <p className="text-xl font-bold">
                {lastSample ? `${lastSample.accuracy.toFixed(1)} m` : "Calibrating..."}
              </p>
            </div>
          </div>

          {/* Critical Backgrounding Reminder */}
          <div className="p-3 bg-amber-950/60 border border-amber-800 rounded-xl text-amber-200 text-xs leading-relaxed">
            <strong>⚠️ වැදගත් උපදෙස:</strong> මෙම App එක Close නොකරන්න. Screen එක On කර හෝ Background එකේ තබාගෙන ඔබගේ රාජකාරි කටයුතු කරගෙන යන්න. ඔබගේ Live Location එක Administrator ගේ Map එකේ පෙනේ.
          </div>

          {/* STOP TRACKING & LOGOUT BUTTON */}
          <button
            type="button"
            onClick={handleStopAndLogout}
            disabled={isLoading}
            className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm shadow-xl shadow-rose-950 flex items-center justify-center space-x-2 transition disabled:opacity-50"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>{isLoading ? "Stopping..." : "STOP TRACKING & LOG OUT (ට්‍රැකින් නවතා ඉවත් වන්න)"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
