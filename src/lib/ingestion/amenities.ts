import type { AmenityKey } from "@/lib/taxonomy";

const RULES: [RegExp, AmenityKey][] = [
  [/audio[\s/-]*visual|\ba\/v\b|\bav\b|av equipment|av capabilities|presentation (?:setup|equipment|capabilit)/i, "av_equipment"],
  [/\btvs?\b|television|flat[- ]?screen|monitor|hdtv|smart tv/i, "tv"],
  [/projector/i, "projector"],
  [/\bscreens?\b|drop-?down screen/i, "screen"],
  [/microphone|\bmics?\b|podium|lectern/i, "microphone"],
  [/sound system|speakers|surround sound|audio system|bluetooth/i, "speakers"],
  [/private bar|dedicated bar|own bar|built-in bar|full-service bar in/i, "private_bar"],
  [/full bar|bar service|cocktail service|craft cocktails/i, "full_bar"],
  [/wi-?fi|wireless internet/i, "wifi"],
  [/handicap|wheelchair|\bada\b|accessible/i, "wheelchair_accessible"],
  [/valet/i, "valet"],
  [/(?<!valet\s)\bparking\b|garage/i, "parking"],
  [/private entrance|separate entrance|own entrance|dedicated entrance|private elevator/i, "separate_entrance"],
  [/natural light|floor-to-ceiling windows|large windows|skylight|sunlit|views?\b|overlook|balcony|terrace/i, "natural_light"],
  [/fireplace|fire pit|firepit/i, "fireplace"],
  [/dance floor|dancing/i, "dance_floor"],
  [/\bstage\b/i, "stage"],
  [/whiteboard|dry[- ]erase|flip ?chart/i, "whiteboard"],
  [/conference (?:phone|call)|speakerphone/i, "conference_phone"],
  [/heaters?|heated|misters?|fans\b|climate[- ]controlled|air-?conditioned patio|covered patio/i, "climate_control"],
  [/coat check|coat room/i, "coat_check"],
  [/live music|\bband\b|\bdj\b|musicians?/i, "live_music_allowed"],
];

/** Map free-text feature descriptions ("A/V setup | Valet parking") to amenity keys. */
export function mapAmenityText(text: string | null | undefined): AmenityKey[] {
  if (!text) return [];
  const found = new Set<AmenityKey>();
  const parts = text.split(/\s*[|;•\n]\s*/).filter(Boolean);
  for (const part of parts) {
    for (const [re, key] of RULES) if (re.test(part)) found.add(key);
  }
  return Array.from(found);
}

const FOOD_RULES: [RegExp, string][] = [
  [/prix[- ]fixe|pre-?set|preset menu|set menu|fixed menu|limited menu/i, "prix_fixe"],
  [/family[- ]style/i, "family_style"],
  [/buffet/i, "buffet"],
  [/plated|three-course|multi-course|coursed/i, "plated"],
  [/cocktail reception|reception[- ]style|mingling/i, "cocktail_reception"],
  [/passed (?:appetizers|hors|apps|bites)|hors d'oeuvres|canap/i, "passed_appetizers"],
  [/tasting menu|omakase|chef's tasting/i, "chef_tasting"],
  [/a la carte|à la carte/i, "a_la_carte"],
  [/custom(?:ized|izable)?\b|bespoke menu|tailored menu/i, "custom_menu"],
];

export function mapFoodStyleText(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const [re, key] of FOOD_RULES) if (re.test(text)) found.add(key);
  return Array.from(found);
}
