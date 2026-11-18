"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Map,
  Truck,
  Layers,
  History,
  FileText,
  LogOut,
  User,
  Radio,
  Menu,
  X,
  Compass,
} from "lucide-react";

interface NavbarProps {
  socketConnected?: boolean;
}

export function Navbar({ socketConnected = false }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hide Navbar completely on Driver screen and Login screen to prevent map access
  if (pathname === "/login" || pathname === "/driver") {
    return null;
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const isDriver = currentUser?.role === "driver";
  const navLinks = isDriver
    ? [{ label: "Driver Duty Tracking", href: "/driver", icon: Compass }]
    : [
        { label: "Live Dashboard", href: "/dashboard", icon: Map },
        { label: "Driver Tracking", href: "/driver", icon: Compass },
        { label: "Port Yards", href: "/yards", icon: Layers },
        { label: "History Trail", href: "/history", icon: History },
        { label: "Audit Logs", href: "/audit", icon: FileText },
      ];

  return (
    <nav className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <Link href="/dashboard" className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-700 flex items-center justify-center shadow-lg shadow-sky-950">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-white block leading-tight">
                  PERI TRACKER
                </span>
                <span className="text-[10px] text-sky-400 font-mono tracking-wider block">
                  HAMBANTOTA PORT (HIPG)
                </span>
              </div>
            </Link>

            {/* Socket Stream Status Badge */}
            <div className="hidden md:flex items-center space-x-1.5 ml-4 px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-[10px] font-semibold">
              <span
                className={`w-2 h-2 rounded-full ${
                  socketConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
              <span className="text-slate-300">
                {socketConnected ? "Stream Active" : "Reconnecting"}
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? "bg-sky-600/20 text-sky-400 border border-sky-500/30"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User profile & actions */}
          <div className="hidden md:flex items-center space-x-3">
            {currentUser ? (
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <span className="text-xs font-bold text-white block leading-tight">
                    {currentUser.fullName}
                  </span>
                  <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-800">
                    {currentUser.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 rounded-lg transition"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition shadow"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="lg:hidden flex items-center space-x-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-800 bg-slate-900 px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-2 px-3 py-2.5 rounded-lg text-sm font-semibold ${
                  isActive
                    ? "bg-sky-600/20 text-sky-400 border border-sky-500/30"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </Link>
            );
          })}

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            {currentUser ? (
              <>
                <div>
                  <span className="text-xs font-bold text-white block">{currentUser.fullName}</span>
                  <span className="text-[10px] text-sky-400 uppercase font-mono">{currentUser.role}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-rose-950 text-rose-300 rounded-lg text-xs font-semibold border border-rose-800"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="w-full py-2 bg-sky-600 text-white text-center rounded-lg text-xs font-bold"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

