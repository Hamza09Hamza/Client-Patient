import { readFile } from "fs/promises";
import { basename, extname, join } from "path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

// Serves uploaded ID photos to authenticated admins only.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await params;
  const safeName = basename(name); // strip any path components
  const type = CONTENT_TYPES[extname(safeName).toLowerCase()];
  if (!type) return NextResponse.json({ error: "Unsupported file" }, { status: 400 });

  try {
    const data = await readFile(join(process.cwd(), "uploads", safeName));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": type, "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
