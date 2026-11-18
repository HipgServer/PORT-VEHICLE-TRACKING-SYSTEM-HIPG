"use client";

import { useEffect, useState } from "react";
import { WifiOff, Database } from "lucide-react";
import { gpsOfflineQueue } from "@/lib/gps/indexedDBQueue";

export function OfflineStateIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const checkQueue = async () => {
      const count = await gpsOfflineQueue.getPendingCount();
      setPendingCount(count);
    };

    checkQueue();
    const interval = setInterval(checkQueue, 4000);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`px-3 py-1.5 text-xs font-semibold flex items-center justify-between text-white ${
        !isOnline ? "bg-amber-600" : "bg-sky-700"
      }`}
    >
      <div className="flex items-center space-x-2">
        {!isOnline ? (
          <>
            <WifiOff className="w-3.5 h-3.5 animate-pulse" />
            <span>Working Offline – Network Disconnected</span>
          </>
        ) : (
          <>
            <Database className="w-3.5 h-3.5 animate-spin" />
            <span>Syncing Buffered GPS Records...</span>
          </>
        )}
      </div>

      {pendingCount > 0 && (
        <span className="bg-black/30 px-2 py-0.5 rounded text-[11px]">
          {pendingCount} record{pendingCount > 1 ? "s" : ""} in offline buffer
        </span>
      )}
    </div>
  );
}

