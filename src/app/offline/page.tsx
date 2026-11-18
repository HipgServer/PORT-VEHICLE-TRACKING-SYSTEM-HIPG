"use client";

import Link from "next/link";
import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-6">
        <WifiOff className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold mb-2">You are currently offline</h1>
      <p className="text-slate-400 max-w-md text-sm mb-6">
        The network connection was lost. If you are an active driver, your GPS coordinates are being safely preserved in local IndexedDB storage and will automatically upload once network is restored.
      </p>

      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
        <button
          onClick={() => {
            if (typeof window !== "undefined") window.location.reload();
          }}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 font-semibold rounded-lg text-sm flex items-center justify-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Reconnecting</span>
        </button>
        <Link
          href="/driver"
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 font-semibold rounded-lg text-sm text-center"
        >
          Go to Driver Screen
        </Link>
      </div>
    </div>
  );
}
