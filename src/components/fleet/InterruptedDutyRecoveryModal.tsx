"use client";

import { useState } from "react";
import { AlertCircle, Check, X, ShieldAlert, Clock, RefreshCw } from "lucide-react";

interface InterruptedDutyRecoveryModalProps {
  session: {
    id: string;
    vehicleNumber: string;
    driverName: string;
    interruptedAt: string;
    reason?: string;
  };
  onClose: () => void;
  onRecovered: () => void;
}

export function InterruptedDutyRecoveryModal({
  session,
  onClose,
  onRecovered,
}: InterruptedDutyRecoveryModalProps) {
  const [action, setAction] = useState<"resume" | "force_complete">("force_complete");
  const [supervisorNotes, setSupervisorNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/duty/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dutySessionId: session.id,
          action,
          supervisorNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to recover duty session");
      }

      onRecovered();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold">Supervisor Duty Session Recovery</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-950 border border-rose-800 text-rose-300 text-xs rounded-xl">
            {error}
          </div>
        )}

        <div className="bg-slate-800/60 p-4 rounded-xl space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400 font-medium">Vehicle:</span>
            <span className="font-bold text-sky-400">{session.vehicleNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 font-medium">Driver:</span>
            <span className="font-bold text-white">{session.driverName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 font-medium">Interruption Time:</span>
            <span className="font-mono text-amber-300">
              {new Date(session.interruptedAt).toLocaleString()}
            </span>
          </div>
          {session.reason && (
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Interruption Cause:</span>
              <span className="text-slate-300">{session.reason}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">Recovery Resolution Action</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAction("force_complete")}
              className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center space-y-1 ${
                action === "force_complete"
                  ? "bg-rose-900/50 border-rose-500 text-rose-200"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Force Complete Shift</span>
            </button>

            <button
              type="button"
              onClick={() => setAction("resume")}
              className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center space-y-1 ${
                action === "resume"
                  ? "bg-emerald-900/50 border-emerald-500 text-emerald-200"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Resume Active Duty</span>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Supervisor Audit Notes (Required)
          </label>
          <textarea
            value={supervisorNotes}
            onChange={(e) => setSupervisorNotes(e.target.value)}
            placeholder="Document reason for intervention, e.g. Driver phone battery depleted, confirmed shift completed at gate..."
            rows={3}
            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !supervisorNotes.trim()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition"
          >
            {loading ? "Processing..." : "Confirm Recovery"}
          </button>
        </div>
      </div>
    </div>
  );
}

