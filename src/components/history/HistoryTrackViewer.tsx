"use client";

import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, Calendar, Clock, Navigation } from "lucide-react";

interface HistoryTrackViewerProps {
  vehicleId: string;
  vehicleNumber: string;
  onPointsLoaded?: (coordinates: [number, number][]) => void;
  onCurrentPointChange?: (point: any) => void;
}

export function HistoryTrackViewer({
  vehicleId,
  vehicleNumber,
  onPointsLoaded,
  onCurrentPointChange,
}: HistoryTrackViewerProps) {
  const [points, setPoints] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  useEffect(() => {
    if (!vehicleId) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/history?vehicleId=${vehicleId}&limit=500`);
        const data = await res.json();
        if (data.success && data.points) {
          setPoints(data.points);
          setCurrentIndex(0);
          if (onPointsLoaded) {
            onPointsLoaded(data.points.map((p: any) => p.coordinates));
          }
        }
      } catch (err) {
        console.error("Failed to fetch location history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [vehicleId]);

  useEffect(() => {
    let timer: any;
    if (isPlaying && points.length > 0) {
      timer = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= points.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          if (onCurrentPointChange) onCurrentPointChange(points[next]);
          return next;
        });
      }, 500 / playbackSpeed);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, points, playbackSpeed, onCurrentPointChange]);

  const currentPoint = points[currentIndex];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Track Replay</span>
          <h4 className="text-sm font-bold text-sky-400">{vehicleNumber} Movement History</h4>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {points.length} GPS Points Recorded
        </span>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading historical trail...</div>
      ) : points.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">
          No historical GPS points recorded for this vehicle yet.
        </div>
      ) : (
        <div className="space-y-3">
          {/* Progress Slider */}
          <div>
            <input
              type="range"
              min={0}
              max={points.length - 1}
              value={currentIndex}
              onChange={(e) => {
                const idx = Number(e.target.value);
                setCurrentIndex(idx);
                if (onCurrentPointChange) onCurrentPointChange(points[idx]);
              }}
              className="w-full accent-sky-400 bg-slate-800 rounded-lg cursor-pointer h-2"
            />
          </div>

          {/* Current Point Telemetry */}
          {currentPoint && (
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-500">Timestamp</span>
                <p className="font-mono text-slate-300">
                  {new Date(currentPoint.timestamp).toLocaleTimeString()}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500">Recorded Speed</span>
                <p className="font-bold text-emerald-400">{currentPoint.speed?.toFixed(1)} km/h</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500">Yard Location</span>
                <p className="font-semibold text-slate-200 truncate">
                  {currentPoint.yard?.name || "Transit Lane"}
                </p>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </button>
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentIndex(0);
                  if (onCurrentPointChange && points[0]) onCurrentPointChange(points[0]);
                }}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                title="Reset to start"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center space-x-1 text-xs">
              <span className="text-slate-400">Speed:</span>
              {[1, 2, 5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    playbackSpeed === spd
                      ? "bg-sky-500 text-slate-950"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

