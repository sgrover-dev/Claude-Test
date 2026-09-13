import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(sp.next && sp.next.startsWith("/") ? sp.next : "/account");
  return (
    <div className="container-page flex justify-center py-16">
      <div className="card w-full max-w-md p-8">
        <h1 className="font-display text-[30px] text-ink-900">Sign in to Red Rope</h1>
        <p className="mt-1.5 text-[14.5px] text-ink-600">No password. We'll email you a link that signs you in.</p>
        {sp.error ? <p className="mt-4 rounded-xl bg-rope-50 px-3 py-2 text-[14px] text-rope-800">{sp.error}</p> : null}
        <LoginForm next={sp.next ?? ""} />
      </div>
    </div>
  );
}
