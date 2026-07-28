import { LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";

export function LogoutButton({
  label,
  /** "light" for the marine masthead. */
  tone = "dark",
}: {
  label: string;
  tone?: "dark" | "light";
}) {
  const light = tone === "light";
  return (
    <form action={logout}>
      <button
        type="submit"
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
          light
            ? "text-on-marine-dim hover:bg-white/10 hover:text-white"
            : "text-ink-muted hover:bg-danger-soft hover:text-danger"
        }`}
      >
        <LogOut aria-hidden className="size-4" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    </form>
  );
}
