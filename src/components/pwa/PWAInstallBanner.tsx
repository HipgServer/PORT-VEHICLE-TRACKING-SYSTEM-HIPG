"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Detect if already installed / running in standalone mode
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsStandalone(true);
      return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      setShowIosGuide(true);
    }
  };

  if (isStandalone || isDismissed) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 border-b border-blue-700/50 text-white px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm">
        <div className="flex items-center space-x-2">
          <Smartphone className="w-4 h-4 text-sky-400 shrink-0" />
          <span>
            <strong>Install Port Vehicle Tracker PWA</strong> for offline GPS buffering and fast driver access.
          </span>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleInstallClick}
            className="flex items-center space-x-1 px-3 py-1 bg-sky-500 hover:bg-sky-400 text-slate-900 font-semibold rounded-md shadow transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 text-slate-300 hover:text-white"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-5 text-white">
            <h3 className="font-bold text-base mb-2">Install on Your Device</h3>
            <p className="text-sm text-slate-300 mb-4">
              To install this PWA on your home screen:
            </p>
            <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside mb-4">
              <li>Tap the <strong>Share</strong> button in your browser toolbar</li>
              <li>Scroll down and select <strong>&quot;Add to Home Screen&quot;</strong></li>
              <li>Confirm and launch directly from your home screen</li>
            </ol>
            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 font-semibold rounded-lg text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

