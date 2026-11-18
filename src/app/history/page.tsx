"use client";

import { useEffect, useState } from "react";
import { PortMap } from "@/components/map/PortMap";
import { HistoryTrackViewer } from "@/components/history/HistoryTrackViewer";
import { Truck, Navigation, Search } from "lucide-react";

export default function HistoryPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [yards, setYards] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [breadcrumbTrail, setBreadcrumbTrail] = useState<[number, number][]>([]);
  const [activePoint, setActivePoint] = useState<any>(null);

  useEffect(() => {
    Promise.all([fetch("/api/vehicles"), fetch("/api/yards")])
      .then(async ([vRes, yRes]) => {
        const [vData, yData] = await Promise.all([vRes.json(), yRes.json()]);
        if (vData.vehicles) {
          setVehicles(vData.vehicles);
          if (vData.vehicles.length > 0) {
            setSelectedVehicleId(vData.vehicles[0].id);
          }
        }
        if (yData.yards) setYards(yData.yards);
      })
      .catch((err) => console.error(err));
  }, []);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-4 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div>
          <h2 className="text-lg font-bold text-white">Historical Movement Breadcrumb Trail</h2>
          <p className="text-xs text-slate-400">
            Replay and analyze vehicle travel paths, speed changes, and yard transit sequences.
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Truck className="w-4 h-4 text-sky-400" />
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-none"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vehicleNumber} – {v.makeModel}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* Map */}
        <div className="lg:col-span-8 min-h-[450px] bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-xl flex flex-col">
          <PortMap
            yards={yards}
            vehicles={
              activePoint
                ? [
                    {
                      id: selectedVehicleId,
                      vehicleNumber: selectedVehicle?.vehicleNumber || "VEH",
                      type: selectedVehicle?.type || "terminal_tractor",
                      makeModel: selectedVehicle?.makeModel || "",
                      status: "active",
                      trackingStatus: "ONLINE",
                      dutyStatus: "DUTY_ACTIVE",
                      longitude: activePoint.coordinates[0],
                      latitude: activePoint.coordinates[1],
                      lastHeading: activePoint.heading,
                      lastSpeed: activePoint.speed,
                    },
                  ]
                : []
            }
            showBreadcrumbTrail={breadcrumbTrail}
            center={
              breadcrumbTrail.length > 0
                ? breadcrumbTrail[0]
                : [81.1180, 6.1205]
            }
          />
        </div>

        {/* Playback controller */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          {selectedVehicle && (
            <HistoryTrackViewer
              vehicleId={selectedVehicle.id}
              vehicleNumber={selectedVehicle.vehicleNumber}
              onPointsLoaded={(pts) => setBreadcrumbTrail(pts)}
              onCurrentPointChange={(pt) => setActivePoint(pt)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

