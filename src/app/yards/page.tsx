"use client";

import { useEffect, useState } from "react";
import { PortMap } from "@/components/map/PortMap";
import { Layers, Gauge, Shield, Warehouse, CheckCircle2 } from "lucide-react";

export default function YardsPage() {
  const [yards, setYards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/yards")
      .then((res) => res.json())
      .then((data) => {
        if (data.yards) setYards(data.yards);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-4 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div>
          <h2 className="text-lg font-bold text-white">Hambantota Port (HIPG) Yard Management</h2>
          <p className="text-xs text-slate-400">
            Authoritative GeoJSON geofence boundaries, terminal capacities, and vehicle dwell zones.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-sky-400 font-semibold bg-sky-950/80 px-3 py-1.5 rounded-xl border border-sky-800">
          <Warehouse className="w-4 h-4" />
          <span>{yards.length} Active Terminal Yards</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* Yard Map */}
        <div className="lg:col-span-7 min-h-[420px] bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-xl flex flex-col">
          <PortMap yards={yards} zoom={14.8} />
        </div>

        {/* Yard List & Capacity Cards */}
        <div className="lg:col-span-5 space-y-3 overflow-y-auto max-h-[700px]">
          {yards.map((yard) => (
            <div
              key={yard.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow space-y-3 hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full shadow"
                    style={{ backgroundColor: yard.color }}
                  />
                  <div>
                    <h3 className="font-bold text-sm text-white">{yard.name}</h3>
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400">
                      Code: {yard.code} • {yard.category}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold text-slate-300">
                  Speed Limit: {yard.speedLimitKmh} km/h
                </span>
              </div>

              {yard.description && (
                <p className="text-xs text-slate-400">{yard.description}</p>
              )}

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-[11px] mb-1 font-semibold">
                  <span className="text-slate-400">Current Occupancy</span>
                  <span className="text-slate-200">
                    {yard.currentCount} / {yard.capacity} ({yard.occupancyPercentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, yard.occupancyPercentage || 2)}%`,
                      backgroundColor: yard.color || "#3b82f6",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

