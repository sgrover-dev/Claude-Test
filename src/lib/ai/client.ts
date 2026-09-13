import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/** Returns an Anthropic client, or null when no credentials are configured. */
export function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return null;
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 60_000 });
  return client;
}

export function isAiEnabled(): boolean {
  return getAnthropic() !== null;
}

export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

export type AiMeta = { provider: "anthropic" | "fallback"; model: string | null };

export function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "AI credentials were rejected.";
  if (error instanceof Anthropic.RateLimitError) return "AI provider is rate limiting requests; try again shortly.";
  if (error instanceof Anthropic.APIError) return `AI provider error (${error.status}): ${error.message}`;
  if (error instanceof Error) return error.message;
  return "Unknown AI error";
}
