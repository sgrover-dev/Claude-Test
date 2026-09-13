"use server";
import { redirect } from "next/navigation";
import { requestMagicLink } from "@/lib/auth/magic";
import { destroySession } from "@/lib/auth/session";
import { isDevEmail } from "@/lib/email";

export type LoginState = { status: "idle" } | { status: "sent"; email: string; devLink?: string } | { status: "error"; message: string };

export async function requestLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const next = String(formData.get("next") ?? "") || null;
  try {
    const { link } = await requestMagicLink(email, next);
    return { status: "sent", email, devLink: isDevEmail() ? link : undefined };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Could not send link" };
  }
}

export async function logout() {
  await destroySession();
  redirect("/");
}
