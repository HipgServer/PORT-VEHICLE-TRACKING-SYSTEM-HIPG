import { VehicleTrackingStatus, DutyStatus } from "@/lib/types";

interface VehicleStatusBadgeProps {
  trackingStatus: VehicleTrackingStatus;
  dutyStatus?: DutyStatus;
  isLive?: boolean;
  secondsSinceLastUpdate?: number;
}

export function VehicleStatusBadge({
  trackingStatus,
  dutyStatus,
  isLive,
  secondsSinceLastUpdate,
}: VehicleStatusBadgeProps) {
  const getBadgeStyle = () => {
    switch (trackingStatus) {
      case "ONLINE":
        return "bg-emerald-950/80 text-emerald-400 border-emerald-700/60";
      case "STALE":
        return "bg-amber-950/80 text-amber-400 border-amber-700/60";
      case "OFFLINE":
        return "bg-slate-800 text-slate-400 border-slate-700";
      case "TRACKING_INTERRUPTED":
        return "bg-rose-950/80 text-rose-400 border-rose-700/60 animate-pulse";
      case "NOT_ON_DUTY":
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  const formatDelta = (sec?: number) => {
    if (sec == null || sec < 0) return "No data";
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hrs = Math.floor(min / 60);
    return `${hrs}h ago`;
  };

  return (
    <div className="flex flex-col space-y-1">
      <div className="flex items-center space-x-1.5">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${getBadgeStyle()}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
              trackingStatus === "ONLINE"
                ? "bg-emerald-400 animate-ping"
                : trackingStatus === "TRACKING_INTERRUPTED"
                ? "bg-rose-400"
                : "bg-current"
            }`}
          />
          {trackingStatus}
        </span>
      </div>

      {trackingStatus !== "NOT_ON_DUTY" && secondsSinceLastUpdate != null && (
        <span className="text-[10px] text-slate-400 font-mono">
          {formatDelta(secondsSinceLastUpdate)}
        </span>
      )}
    </div>
  );
}

