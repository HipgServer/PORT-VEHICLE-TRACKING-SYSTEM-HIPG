"use client";

import { useEffect, useState } from "react";

export function ServiceWorkerRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // In local development, unregister service workers to prevent stale chunks & hydration mismatches
    const isDev =
      process.env.NODE_ENV === "development" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isDev) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
        }
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            if (key.startsWith("peri-")) caches.delete(key);
          });
        });
      }
      return;
    }

    // In production, register the Service Worker for offline PWA capabilities
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
          console.log("[PWA] Service Worker registered with scope:", registration.scope);

          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (
                  installingWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  console.log("[PWA] New version available!");
                  setUpdateAvailable(true);
                }
              };
            }
          };
        })
        .catch((error) => {
          console.warn("[PWA] Service Worker registration failed:", error);
        });
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-4 rounded-xl shadow-2xl flex items-center space-x-3 border border-blue-400">
      <div>
        <p className="font-semibold text-sm">System Update Available</p>
        <p className="text-xs text-blue-100">A new version of Peri Tracker is ready.</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="px-3 py-1.5 bg-white text-blue-700 font-semibold rounded-lg text-xs hover:bg-blue-50 transition"
      >
        Reload
      </button>
    </div>
  );
}

