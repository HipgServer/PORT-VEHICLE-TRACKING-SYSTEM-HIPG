"use client";

import { useEffect, useState } from "react";
import { FileText, Layers, ShieldCheck, Clock, MapPin, ArrowRight } from "lucide-react";

export default function AuditPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => {
        if (data.events) setEvents(data.events);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const getEventBadge = (type: string) => {
    switch (type) {
      case "YARD_ENTERED":
        return "bg-emerald-950 text-emerald-400 border-emerald-800";
      case "YARD_EXITED":
        return "bg-rose-950 text-rose-400 border-rose-800";
      case "YARD_CHANGED":
        return "bg-sky-950 text-sky-400 border-sky-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-4 max-w-7xl mx-auto w-full">
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Yard Operational Events & Geofence Audit</h2>
          <p className="text-xs text-slate-400">
            Immutable log of automated boundary detections, consecutive hysteresis confirmations, and supervisor interventions.
          </p>
        </div>
        <div className="flex items-center space-x-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300">
          <FileText className="w-4 h-4 text-sky-400" />
          <span>{events.length} Recent Logged Events</span>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Yard Location Transition</th>
                <th className="py-3 px-4">Coordinates</th>
                <th className="py-3 px-4">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading audit events...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No yard operational events recorded yet.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev._id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(ev.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getEventBadge(
                          ev.eventType
                        )}`}
                      >
                        {ev.eventType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-sky-400">
                        {ev.vehicleId?.vehicleNumber || "VEHICLE"}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-normal">
                        Driver: {ev.driverId?.employeeId || "Unassigned"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        {ev.previousYardId ? (
                          <span className="text-slate-400 font-semibold">{ev.previousYardId.name}</span>
                        ) : (
                          <span className="text-slate-500 italic">Outside</span>
                        )}
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {ev.yardId ? (
                          <span className="font-bold text-white">{ev.yardId.name}</span>
                        ) : (
                          <span className="text-slate-500 italic">Outside Port Yards</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                      [{ev.location?.coordinates[0]?.toFixed(5)}, {ev.location?.coordinates[1]?.toFixed(5)}]
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {ev.accuracy ? `${ev.accuracy.toFixed(1)}m` : "N/A"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

