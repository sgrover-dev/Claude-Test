import { describe, expect, it } from "vitest";
import { canTransition, candidateNeedsFollowUp, nextStatuses, suggestInquiryStatus } from "./state";

describe("inquiry state machine", () => {
  it("allows the happy path", () => {
    const path = ["submitted", "researching", "contacting_venues", "awaiting_venue", "options_available", "customer_reviewing", "customer_selected", "deposit_required", "booking_pending", "booked", "closed"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });
  it("blocks nonsense transitions", () => {
    expect(canTransition("submitted", "booked")).toBe(false);
    expect(canTransition("closed", "submitted")).toBe(false);
    expect(nextStatuses("cancelled")).toEqual([]);
  });
  it("suggests statuses from candidates", () => {
    expect(suggestInquiryStatus("contacting_venues", ["contacted", "not_contacted"])).toBe("awaiting_venue");
    expect(suggestInquiryStatus("awaiting_venue", ["contacted", "quote_received"])).toBe("options_available");
    expect(suggestInquiryStatus("options_available", ["customer_selected", "unavailable"])).toBe("customer_selected");
    expect(suggestInquiryStatus("awaiting_venue", ["unavailable", "unavailable"])).toBe("researching");
    expect(suggestInquiryStatus("booked", ["quote_received"])).toBe("booked");
  });
  it("flags follow-ups after 48h", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    expect(candidateNeedsFollowUp("contacted", new Date("2026-09-28T12:00:00Z"), now)).toBe(true);
    expect(candidateNeedsFollowUp("contacted", new Date("2026-09-30T20:00:00Z"), now)).toBe(false);
    expect(candidateNeedsFollowUp("available", new Date("2026-09-01T12:00:00Z"), now)).toBe(false);
    expect(candidateNeedsFollowUp("follow_up_due", null, now)).toBe(true);
  });
});
