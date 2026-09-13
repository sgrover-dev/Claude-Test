import Link from "next/link";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { Logo } from "./Logo";

export async function Header({ transparent = false }: { transparent?: boolean }) {
  const user = await getCurrentUser();
  const isOps = hasRole(user, "ops");
  return (
    <header className={`${transparent ? "absolute inset-x-0 top-0 z-30" : "sticky top-0 z-30 border-b border-ink-200/70 bg-white/85 backdrop-blur"}`}>
      <div className="container-page flex h-16 items-center justify-between">
        <Logo dark={transparent} />
        <nav className={`flex items-center gap-1 text-[14.5px] font-medium ${transparent ? "text-white/90" : "text-ink-700"}`}>
          <Link href="/search" className="hidden rounded-lg px-3 py-2 hover:bg-black/5 sm:inline-flex">
            Browse spaces
          </Link>
          <Link href="/houston" className="hidden rounded-lg px-3 py-2 hover:bg-black/5 md:inline-flex">
            Houston
          </Link>
          <Link href="/how-it-works" className="hidden rounded-lg px-3 py-2 hover:bg-black/5 md:inline-flex">
            How it works
          </Link>
          {isOps ? (
            <Link href="/admin" className="rounded-lg px-3 py-2 hover:bg-black/5">
              Console
            </Link>
          ) : null}
          {user ? (
            <Link href="/account" className={`${transparent ? "border-white/40 text-white hover:bg-white/10" : "btn-secondary"} btn btn-sm ml-1 border`}>
              {user.name?.split(" ")[0] ?? "Account"}
            </Link>
          ) : (
            <Link href="/login" className={`${transparent ? "border-white/40 text-white hover:bg-white/10" : "btn-secondary"} btn btn-sm ml-1 border`}>
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
