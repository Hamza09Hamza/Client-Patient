import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

// The proxy normally redirects "/" before rendering; this is the fallback.
export default async function HomePage() {
  const session = await getSession();
  if (session?.role === "admin") redirect("/admin");
  if (session?.role === "patient") redirect("/portal");
  redirect("/login");
}
