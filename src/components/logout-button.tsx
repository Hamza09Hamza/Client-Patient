import { LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";

export function LogoutButton({ label }: { label: string }) {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors duration-200 hover:bg-danger-soft hover:text-danger"
      >
        <LogOut aria-hidden className="size-4" />
        {label}
      </button>
    </form>
  );
}
