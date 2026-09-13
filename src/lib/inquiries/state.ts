import type { CandidateStatus, InquiryStatus } from "@/db/schema";

export const INQUIRY_STATUS_ORDER: InquiryStatus[] = [
  "draft",
  "submitted",
  "researching",
  "contacting_venues",
  "awaiting_venue",
  "options_available",
  "customer_reviewing",
  "customer_selected",
  "deposit_required",
  "booking_pending",
  "booked",
  "closed",
  "cancelled",
];

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  researching: "Researching",
  contacting_venues: "Contacting venues",
  awaiting_venue: "Awaiting venue",
  options_available: "Options available",
  customer_reviewing: "Customer reviewing",
  customer_selected: "Customer selected",
  deposit_required: "Deposit required",
  booking_pending: "Booking pending",
  booked: "Booked",
  closed: "Closed",
  cancelled: "Cancelled",
};

/** Customer-facing phrasing for the status. */
export const INQUIRY_STATUS_CUSTOMER: Record<InquiryStatus, string> = {
  draft: "Draft",
  submitted: "Received — we're on it",
  researching: "Researching venues",
  contacting_venues: "Contacting venues",
  awaiting_venue: "Waiting on venues",
  options_available: "Options ready for you",
  customer_reviewing: "Options ready for you",
  customer_selected: "Confirming your pick",
  deposit_required: "Deposit needed",
  booking_pending: "Finalizing booking",
  booked: "Booked",
  closed: "Closed",
  cancelled: "Cancelled",
};

const TERMINAL: InquiryStatus[] = ["closed", "cancelled"];

const TRANSITIONS: Record<InquiryStatus, InquiryStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["researching", "contacting_venues", "cancelled", "closed"],
  researching: ["contacting_venues", "options_available", "cancelled", "closed"],
  contacting_venues: ["awaiting_venue", "options_available", "researching", "cancelled", "closed"],
  awaiting_venue: ["options_available", "contacting_venues", "researching", "cancelled", "closed"],
  options_available: ["customer_reviewing", "customer_selected", "contacting_venues", "cancelled", "closed"],
  customer_reviewing: ["customer_selected", "contacting_venues", "options_available", "cancelled", "closed"],
  customer_selected: ["deposit_required", "booking_pending", "options_available", "cancelled", "closed"],
  deposit_required: ["booking_pending", "booked", "customer_selected", "cancelled", "closed"],
  booking_pending: ["booked", "deposit_required", "customer_selected", "cancelled", "closed"],
  booked: ["closed", "cancelled"],
  closed: [],
  cancelled: [],
};

export function canTransition(from: InquiryStatus, to: InquiryStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: InquiryStatus): InquiryStatus[] {
  return TRANSITIONS[from];
}

export function isTerminal(status: InquiryStatus): boolean {
  return TERMINAL.includes(status);
}

export function isActiveInquiry(status: InquiryStatus): boolean {
  return !isTerminal(status) && status !== "draft";
}

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  not_contacted: "Not contacted",
  contacted: "Contacted",
  follow_up_due: "Follow-up due",
  available: "Available",
  unavailable: "Unavailable",
  needs_clarification: "Needs clarification",
  quote_received: "Quote received",
  customer_rejected: "Customer rejected",
  customer_selected: "Customer selected",
};

export const CANDIDATE_STATUS_ORDER: CandidateStatus[] = [
  "not_contacted",
  "contacted",
  "follow_up_due",
  "needs_clarification",
  "available",
  "quote_received",
  "customer_selected",
  "customer_rejected",
  "unavailable",
];

/**
 * Suggest an inquiry status from the aggregate of candidate statuses.
 * Ops can always override; this only nudges toward a sensible state.
 */
export function suggestInquiryStatus(current: InquiryStatus, candidates: CandidateStatus[]): InquiryStatus {
  if (isTerminal(current) || current === "draft") return current;
  if (["deposit_required", "booking_pending", "booked"].includes(current)) return current;
  if (candidates.some((c) => c === "customer_selected")) return "customer_selected";
  if (candidates.some((c) => c === "quote_received" || c === "available")) {
    return current === "customer_reviewing" ? current : "options_available";
  }
  if (candidates.length && candidates.every((c) => c === "unavailable" || c === "customer_rejected")) return "researching";
  if (candidates.some((c) => c === "contacted" || c === "follow_up_due" || c === "needs_clarification")) return "awaiting_venue";
  if (candidates.some((c) => c === "not_contacted") && current === "submitted") return "researching";
  return current;
}

/** Candidate statuses that mean the venue still owes us an answer. */
export function candidateNeedsFollowUp(status: CandidateStatus, lastContactAt: Date | null, now = new Date()): boolean {
  if (status === "follow_up_due") return true;
  if (status !== "contacted" && status !== "needs_clarification") return false;
  if (!lastContactAt) return false;
  const hours = (now.getTime() - lastContactAt.getTime()) / 36e5;
  return hours >= 48;
}
