"use client";

import { useEffect, useState, useCallback } from "react";
import { PortMap } from "@/components/map/PortMap";
import { VehicleTable } from "@/components/fleet/VehicleTable";
import { InterruptedDutyRecoveryModal } from "@/components/fleet/InterruptedDutyRecoveryModal";
import { usePortSocket } from "@/lib/socket/client";
import {
  Truck,
  Layers,
  Radio,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldAlert,
} from "lucide-react";

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [yards, setYards] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [recoverySession, setRecoverySession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const { socket, isConnected } = usePortSocket();

  const fetchDashboardData = useCallback(async () => {
    try {
      const [vRes, yRes] = await Promise.all([
        fetch("/api/vehicles"),
        fetch("/api/yards"),
      ]);

      if (!vRes.ok || !yRes.ok) return;

      const [vData, yData] = await Promise.all([vRes.json(), yRes.json()]);

      if (vData?.vehicles) setVehicles(vData.vehicles);
      if (yData?.yards) setYards(yData.yards);
    } catch (err) {
      // Gracefully handle transient network errors while server reconnects
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    // Adaptive polling: 3s fast polling on Vercel/serverless when socket stream is inactive, 15s when active
    const pollInterval = isConnected ? 15000 : 3000;
    const interval = setInterval(fetchDashboardData, pollInterval);
    return () => clearInterval(interval);
  }, [fetchDashboardData, isConnected]);

  // Real-time Socket.IO Event Listeners
  useEffect(() => {
    if (!socket) return;

    // 1. Live location broadcast
    socket.on("vehicle:location", (data) => {
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.id === data.vehicleId) {
            return {
              ...v,
              longitude: data.coordinates[0],
              latitude: data.coordinates[1],
              location: { type: "Point", coordinates: data.coordinates },
              speed: data.speed,
              heading: data.heading,
              accuracy: data.accuracy,
              trackingStatus: data.trackingStatus,
              dutyStatus: data.dutyStatus,
              lastAcceptedGpsTime: data.timestamp,
              secondsSinceLastUpdate: 0,
              isLive: true,
              currentYard: data.currentYardId
                ? { _id: data.currentYardId, name: data.currentYardName }
                : null,
            };
          }
          return v;
        })
      );
    });

    // 2. Status broadcast (interrupted, stale, offline)
    socket.on("vehicle:status", (data) => {
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.id === data.vehicleId) {
            return {
              ...v,
              trackingStatus: data.trackingStatus,
              dutyStatus: data.dutyStatus,
            };
          }
          return v;
        })
      );
    });

    // 3. Tracking Interrupted alert
    socket.on("vehicle:tracking-interrupted", (data) => {
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.id === data.vehicleId) {
            return {
              ...v,
              trackingStatus: "TRACKING_INTERRUPTED",
              dutyStatus: "DUTY_INTERRUPTED",
            };
          }
          return v;
        })
      );
    });

    return () => {
      socket.off("vehicle:location");
      socket.off("vehicle:status");
      socket.off("vehicle:tracking-interrupted");
    };
  }, [socket]);

  // Metric Computations
  const totalVehicles = vehicles.length;
  const onlineCount = vehicles.filter((v) => v.trackingStatus === "ONLINE").length;
  const onDutyCount = vehicles.filter((v) => v.dutyStatus === "DUTY_ACTIVE").length;
  const interruptedCount = vehicles.filter(
    (v) => v.trackingStatus === "TRACKING_INTERRUPTED" || v.dutyStatus === "DUTY_INTERRUPTED"
  ).length;

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-4 max-w-7xl mx-auto w-full">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Fleet Capacity
            </span>
            <span className="text-2xl font-black text-white">{totalVehicles}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Online Active GPS
            </span>
            <span className="text-2xl font-black text-emerald-400">{onlineCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800 flex items-center justify-center text-emerald-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Active Shift Duties
            </span>
            <span className="text-2xl font-black text-sky-400">{onDutyCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-950/60 border border-sky-800 flex items-center justify-center text-sky-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Interrupted Alerts
            </span>
            <span className={`text-2xl font-black ${interruptedCount > 0 ? "text-rose-400" : "text-slate-400"}`}>
              {interruptedCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-800 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Content Grid: Map & Fleet Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[550px]">
        {/* Interactive Map (7 cols on desktop) */}
        <div className="lg:col-span-7 flex flex-col h-[450px] lg:h-auto min-h-[450px]">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1 flex-1 flex flex-col shadow-xl">
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-800 text-xs font-semibold">
              <span className="text-slate-300 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <span>Hambantota International Port (HIPG) Live Geo-Tracking</span>
              </span>
              <button
                onClick={fetchDashboardData}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                title="Refresh Map Data"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 p-2">
              <PortMap
                yards={yards}
                vehicles={vehicles}
                selectedVehicleId={selectedVehicleId}
                onSelectVehicle={setSelectedVehicleId}
              />
            </div>
          </div>
        </div>

        {/* Fleet Table & Management (5 cols on desktop) */}
        <div className="lg:col-span-5 flex flex-col h-full min-h-[450px]">
          <VehicleTable
            vehicles={vehicles}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
            onOpenRecoveryModal={(session) => setRecoverySession(session)}
          />
        </div>
      </div>

      {/* Supervisor Recovery Modal */}
      {recoverySession && (
        <InterruptedDutyRecoveryModal
          session={recoverySession}
          onClose={() => setRecoverySession(null)}
          onRecovered={fetchDashboardData}
        />
      )}
    </div>
  );
}

