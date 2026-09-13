/**
 * Email provider abstraction. `console` logs to stdout (development);
 * `resend` posts to Resend's HTTP API. Add providers here, not at call sites.
 */
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export type EmailResult = { ok: true; id?: string; provider: string } | { ok: false; error: string; provider: string };

export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<EmailResult>;
}

const consoleProvider: EmailProvider = {
  name: "console",
  async send(m) {
    console.log(`\n📧 [email:console] To: ${m.to}\nSubject: ${m.subject}\n\n${m.text}\n`);
    return { ok: true, provider: "console" };
  },
};

const resendProvider: EmailProvider = {
  name: "resend",
  async send(m) {
    const key = process.env.RESEND_API_KEY;
    if (!key) return { ok: false, error: "RESEND_API_KEY not set", provider: "resend" };
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Red Rope <hello@redrope.local>",
        to: [m.to],
        subject: m.subject,
        text: m.text,
        html: m.html,
        reply_to: m.replyTo,
      }),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}`, provider: "resend" };
    const json = (await res.json()) as { id?: string };
    return { ok: true, id: json.id, provider: "resend" };
  },
};

export function getEmailProvider(): EmailProvider {
  return process.env.EMAIL_PROVIDER === "resend" ? resendProvider : consoleProvider;
}

export function sendEmail(message: EmailMessage) {
  return getEmailProvider().send(message);
}

/** True when magic links should be surfaced in the UI instead of emailed. */
export function isDevEmail() {
  return getEmailProvider().name === "console" && process.env.NODE_ENV !== "production";
}
