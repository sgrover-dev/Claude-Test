"use client";
import Link from "next/link";
import { useActionState } from "react";
import { requestLogin, type LoginState } from "@/app/actions/auth";
import { Spinner } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestLogin, { status: "idle" });
  if (state.status === "sent") {
    return (
      <div className="mt-6 rounded-xl bg-sage-100 p-4 text-[14.5px] text-sage-700">
        <p className="font-medium">Check your inbox</p>
        <p className="mt-1">We sent a sign-in link to {state.email}. It expires in 15 minutes.</p>
        {state.devLink ? (
          <p className="mt-3 rounded-lg bg-white/70 p-2 text-[13px] text-ink-700">
            <span className="font-medium">Development mode:</span> email isn't configured, so here's your link —{" "}
            <Link href={state.devLink} className="text-rope-700 underline">
              sign in now
            </Link>
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoFocus autoComplete="email" placeholder="you@company.com" className="input" />
      </div>
      {state.status === "error" ? <p className="text-[14px] text-rope-700">{state.message}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? <Spinner /> : null} Email me a sign-in link
      </button>
      <p className="text-center text-[12.5px] text-ink-500">Signing in creates an account if you don't have one.</p>
    </form>
  );
}
