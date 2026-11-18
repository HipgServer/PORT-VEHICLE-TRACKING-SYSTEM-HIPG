"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DriverDutyController } from "@/components/driver/DriverDutyController";
import { Compass, ShieldCheck } from "lucide-react";

export default function DriverPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        // 1. Check auth
        const authRes = await fetch("/api/auth/me");
        const authData = await authRes.json();
        if (!authData.authenticated) {
          router.push("/login");
          return;
        }

        setCurrentUser(authData.user);

        // 2. Check active duty session
        const sessionRes = await fetch("/api/duty/active");
        const sessionData = await sessionRes.json();
        if (sessionData.activeSession) {
          setActiveSession(sessionData.activeSession);
        }

        // 3. Load available vehicles
        const vRes = await fetch("/api/vehicles");
        const vData = await vRes.json();
        if (vData.vehicles) {
          setVehicles(
            vData.vehicles.map((v: any) => ({
              id: v.id,
              vehicleNumber: v.vehicleNumber,
              type: v.type,
              makeModel: v.makeModel,
            }))
          );
        }
      } catch (err) {
        console.error("Driver page init error:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-slate-400 text-sm">
        <Compass className="w-6 h-6 animate-spin text-sky-400 mr-2" />
        <span>Initializing Driver Duty Session...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 bg-slate-950 flex flex-col justify-center">
      <DriverDutyController
        driverId={currentUser?.driverId || currentUser?.userId}
        driverName={currentUser?.fullName || "Port Driver"}
        initialDutySession={activeSession}
        availableVehicles={vehicles}
      />
    </div>
  );
}

