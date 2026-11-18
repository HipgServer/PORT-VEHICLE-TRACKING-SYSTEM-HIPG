import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-6xl font-black text-sky-500 mb-4">404</h1>
      <h2 className="text-xl font-bold mb-2">Page Not Found</h2>
      <p className="text-slate-400 text-sm max-w-md mb-6">
        The requested resource does not exist on Hambantota Port Vehicle Tracking System.
      </p>
      <Link
        href="/dashboard"
        className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}

