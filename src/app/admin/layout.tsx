import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { Logo } from "@/components/site/Logo";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata = { title: { default: "Console", template: "%s · Red Rope Console" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!hasRole(user, "ops")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
        <div className="card max-w-md p-8 text-center">
          <h1 className="font-display text-[26px] text-ink-900">Staff only</h1>
          <p className="mt-2 text-[14.5px] text-ink-600">This account ({user.email}) doesn't have console access. Add it to ADMIN_EMAILS or ask an admin to grant the ops role.</p>
          <Link href="/" className="btn-secondary mt-5">Back to Red Rope</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen bg-ink-50 text-[14px] text-ink-900">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink-200 bg-white md:flex">
        <div className="flex h-14 items-center border-b border-ink-100 px-4">
          <Logo />
          <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-600">Console</span>
        </div>
        <AdminNav />
        <div className="mt-auto border-t border-ink-100 p-3 text-[12.5px] text-ink-600">
          <p className="truncate font-medium text-ink-800">{user.email}</p>
          <p className="capitalize">{user.role}</p>
          <div className="mt-2 flex gap-3">
            <Link href="/" className="hover:text-rope-700">View site</Link>
            <form action={logout}>
              <button className="hover:text-rope-700">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="border-b border-ink-200 bg-white px-4 py-2 md:hidden">
          <AdminNav horizontal />
        </div>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
