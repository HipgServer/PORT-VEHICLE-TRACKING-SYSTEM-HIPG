import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth/jwt";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("peri_session")?.value;

  if (token) {
    const payload = verifyToken(token);
    if (payload?.role === "driver") {
      redirect("/driver");
    } else if (
      payload?.role === "admin" ||
      payload?.role === "supervisor" ||
      payload?.role === "operator"
    ) {
      redirect("/dashboard");
    }
  }

  // Default to Driver Login on first launch
  redirect("/login");
}

