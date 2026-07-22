import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// Optimistic auth checks only — every page/action re-verifies via the DAL.
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const redirect = (to: string) => NextResponse.redirect(new URL(to, request.url));

  if (pathname === "/") {
    if (session?.role === "admin") return redirect("/admin");
    if (session?.role === "patient") return redirect("/portal");
    return redirect("/login");
  }

  if (pathname.startsWith("/portal")) {
    if (session?.role !== "patient") return redirect("/login");
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (session?.role !== "admin") return redirect("/admin/login");
    return NextResponse.next();
  }

  if (pathname === "/login" && session?.role === "patient") return redirect("/portal");
  if (pathname === "/admin/login" && session?.role === "admin") return redirect("/admin");

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/portal/:path*", "/admin/:path*"],
};
