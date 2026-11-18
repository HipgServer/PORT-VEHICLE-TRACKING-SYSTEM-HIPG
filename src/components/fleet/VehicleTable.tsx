"use client";

import { useState } from "react";
import { IVehicleView } from "@/lib/types";
import { VehicleStatusBadge } from "./VehicleStatusBadge";
import { Truck, Navigation, AlertCircle, Wrench, Search, MapPin } from "lucide-react";

interface VehicleTableProps {
  vehicles: any[];
  selectedVehicleId?: string | null;
  onSelectVehicle: (id: string) => void;
  onOpenRecoveryModal?: (session: any) => void;
}

export function VehicleTable({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  onOpenRecoveryModal,
}: VehicleTableProps) {
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filtered = vehicles.filter((v) => {
    const matchesType = filterType === "all" || v.type === filterType;
    const matchesSearch =
      v.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.makeModel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.currentYard?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col h-full">
      {/* Controls header */}
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search vehicle, yard, model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
          >
            <option value="all">All Vehicle Types</option>
            <option value="terminal_tractor">Terminal Tractors</option>
            <option value="reach_stacker">Reach Stackers</option>
            <option value="forklift">Forklifts</option>
            <option value="shuttle_bus">Shuttle Buses</option>
            <option value="pickup">Pickups</option>
            <option value="patrol_car">Patrol Cars</option>
          </select>
        </div>
      </div>

      {/* Vehicle List Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Vehicle</th>
              <th className="py-3 px-3">Tracking Status</th>
              <th className="py-3 px-3">Assigned Yard</th>
              <th className="py-3 px-3">Telemetry</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {filtered.map((v) => {
              const isSelected = selectedVehicleId === v.id;
              const isInterrupted =
                v.trackingStatus === "TRACKING_INTERRUPTED" || v.dutyStatus === "DUTY_INTERRUPTED";

              return (
                <tr
                  key={v.id}
                  onClick={() => onSelectVehicle(v.id)}
                  className={`cursor-pointer transition hover:bg-slate-800/40 ${
                    isSelected ? "bg-sky-950/40 border-l-4 border-sky-400" : ""
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400">
                        <Truck className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-bold text-white text-xs">{v.vehicleNumber}</div>
                        <div className="text-[10px] text-slate-400">{v.makeModel}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <VehicleStatusBadge
                      trackingStatus={v.trackingStatus}
                      dutyStatus={v.dutyStatus}
                      isLive={v.isLive}
                      secondsSinceLastUpdate={v.secondsSinceLastUpdate}
                    />
                  </td>

                  <td className="py-3 px-3">
                    {v.currentYard ? (
                      <div className="flex items-center space-x-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: v.currentYard.color || "#3b82f6" }}
                        />
                        <span className="font-semibold text-slate-200 text-xs">
                          {v.currentYard.code}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[11px]">Outside Yards</span>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex flex-col text-[11px]">
                      <span className="font-mono text-slate-200">
                        {v.speed ? `${v.speed.toFixed(1)} km/h` : "Stationary"}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        Acc: {v.accuracy ? `${v.accuracy.toFixed(1)}m` : "N/A"}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {isInterrupted && onOpenRecoveryModal && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenRecoveryModal({
                              id: v.activeDutySessionId,
                              vehicleNumber: v.vehicleNumber,
                              driverName: v.assignedDriver?.fullName || "Assigned Driver",
                              interruptedAt: v.lastAcceptedGpsTime || new Date().toISOString(),
                              reason: "Mobile browser hidden or connection dropped",
                            });
                          }}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-bold shadow flex items-center space-x-1"
                        >
                          <AlertCircle className="w-3 h-3" />
                          <span>Recover</span>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectVehicle(v.id);
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-sky-400"
                        title="Locate on map"
                      >
                        <MapPin className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

