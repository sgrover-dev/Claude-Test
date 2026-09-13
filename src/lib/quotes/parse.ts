/**
 * Deterministic parser for common restaurant pricing phrasing.
 * Used as a fallback when the AI extractor is unavailable, and as a sanity
 * check on model output. It never invents values it cannot find.
 */
import type { QuoteInput } from "./normalize";

const money = (s: string) => Math.round(parseFloat(s.replace(/[$,]/g, "")) * 100);

export function parseQuoteText(text: string, guestCount: number): Partial<QuoteInput> {
  const t = text.replace(/\s+/g, " ");
  const out: Partial<QuoteInput> = { guestCount };

  const perPerson = t.match(/\$\s?([\d,]+(?:\.\d{2})?)\s*(?:\/|per)\s*(?:person|pp|guest|head)/i);
  if (perPerson) out.perPersonCents = money(perPerson[1]);

  const minimum =
    t.match(/\$\s?([\d,]+(?:\.\d{2})?)(?:\s*(?:f\s*&\s*b|food\s*(?:and|&)\s*beverage))?\s*(?:minimum|min\b)/i) ||
    t.match(/(?:minimum|min\.?)\s*(?:spend|of)?\s*(?:is|of)?\s*\$\s?([\d,]+(?:\.\d{2})?)/i);
  if (minimum) out.fbMinimumCents = money(minimum[1]);

  const roomFee =
    t.match(/\$\s?([\d,]+(?:\.\d{2})?)\s*(?:room|rental|venue|site)\s*(?:fee|rental|charge)/i) ||
    t.match(/(?:room|rental|venue|site)\s*(?:fee|rental|charge)\s*(?:of|is|:)?\s*\$\s?([\d,]+(?:\.\d{2})?)/i);
  if (roomFee) out.roomFeeCents = money(roomFee[1]);

  const deposit =
    t.match(/\$\s?([\d,]+(?:\.\d{2})?)\s*(?:deposit)/i) ||
    t.match(/deposit\s*(?:of|is|:)?\s*\$\s?([\d,]+(?:\.\d{2})?)/i);
  if (deposit) out.depositCents = money(deposit[1]);

  const service = t.match(/(\d{1,2}(?:\.\d+)?)\s*%\s*(?:service|gratuity|grat\b|tip)/i) ||
    t.match(/(?:service charge|gratuity)\s*(?:of|is|:)?\s*(\d{1,2}(?:\.\d+)?)\s*%/i);
  if (service) out.serviceChargePct = parseFloat(service[1]);

  const admin = t.match(/(\d{1,2}(?:\.\d+)?)\s*%\s*(?:admin|administrative)/i);
  if (admin) out.adminFeePct = parseFloat(admin[1]);

  const tax = t.match(/(\d{1,2}(?:\.\d+)?)\s*%\s*(?:sales\s*)?tax/i);
  if (tax) out.taxPct = parseFloat(tax[1]);

  if (/inclusive of (?:the )?room/i.test(t) || /includes? (?:the )?room/i.test(t)) out.minimumIncludesRoomFee = true;
  if (/inclusive of (?:tax|service|gratuity)/i.test(t) || /(?:tax|gratuity)\s*(?:and|&)\s*(?:tax|gratuity)\s*included/i.test(t) || /all[- ]inclusive/i.test(t)) {
    out.minimumIncludesServiceAndTax = true;
  }
  if (/plus (?:\d+(?:\.\d+)?%\s*)?(?:tax|gratuity|service)|\+\s*(?:\d+(?:\.\d+)?%\s*)?(?:tax|gratuity|service)|(?:before|excluding|exclusive of) (?:tax|gratuity)/i.test(t)) {
    out.minimumIncludesServiceAndTax = false;
  }

  return out;
}
