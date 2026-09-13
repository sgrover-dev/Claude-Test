/**
 * Shared vocabularies. Keys are stored in the database; labels are for display.
 * Keep keys stable — they appear in URLs, CSV imports and AI extraction schemas.
 */

export type Option<K extends string = string> = { key: K; label: string; hint?: string };

export const AMENITIES = [
  { key: "av_equipment", label: "AV equipment" },
  { key: "tv", label: "TV" },
  { key: "projector", label: "Projector" },
  { key: "screen", label: "Screen" },
  { key: "microphone", label: "Microphone" },
  { key: "speakers", label: "Speakers / sound system" },
  { key: "private_bar", label: "Private bar" },
  { key: "full_bar", label: "Full bar service" },
  { key: "wifi", label: "Wi-Fi" },
  { key: "wheelchair_accessible", label: "Wheelchair accessible" },
  { key: "valet", label: "Valet" },
  { key: "parking", label: "Parking lot / garage" },
  { key: "separate_entrance", label: "Separate entrance" },
  { key: "natural_light", label: "Natural light" },
  { key: "fireplace", label: "Fireplace" },
  { key: "dance_floor", label: "Dance floor" },
  { key: "stage", label: "Stage" },
  { key: "whiteboard", label: "Whiteboard" },
  { key: "conference_phone", label: "Conference phone" },
  { key: "climate_control", label: "Heated / cooled outdoor" },
  { key: "coat_check", label: "Coat check" },
  { key: "live_music_allowed", label: "Live music allowed" },
] as const satisfies readonly Option[];
export type AmenityKey = (typeof AMENITIES)[number]["key"];

/** Amenities that satisfy an "AV required" search. */
export const AV_AMENITIES: AmenityKey[] = ["av_equipment", "tv", "projector", "screen", "microphone", "speakers"];
export const DISPLAY_AMENITIES: AmenityKey[] = ["av_equipment", "tv", "projector", "screen"];
export const PARKING_AMENITIES: AmenityKey[] = ["valet", "parking"];
export const ALCOHOL_AMENITIES: AmenityKey[] = ["private_bar", "full_bar"];

export const FOOD_STYLES = [
  { key: "prix_fixe", label: "Prix fixe" },
  { key: "family_style", label: "Family style" },
  { key: "buffet", label: "Buffet" },
  { key: "plated", label: "Plated" },
  { key: "cocktail_reception", label: "Cocktail reception" },
  { key: "passed_appetizers", label: "Passed appetizers" },
  { key: "chef_tasting", label: "Chef's tasting" },
  { key: "a_la_carte", label: "À la carte" },
  { key: "custom_menu", label: "Custom menu" },
] as const satisfies readonly Option[];
export type FoodStyleKey = (typeof FOOD_STYLES)[number]["key"];

export const AMBIANCE = [
  { key: "upscale", label: "Upscale" },
  { key: "casual", label: "Casual" },
  { key: "lively", label: "Lively" },
  { key: "intimate", label: "Intimate" },
  { key: "romantic", label: "Romantic" },
  { key: "modern", label: "Modern" },
  { key: "classic", label: "Classic" },
  { key: "rustic", label: "Rustic" },
  { key: "trendy", label: "Trendy" },
  { key: "quiet", label: "Quiet" },
  { key: "scenic_view", label: "Scenic view" },
  { key: "historic", label: "Historic" },
] as const satisfies readonly Option[];
export type AmbianceKey = (typeof AMBIANCE)[number]["key"];

export const EVENT_TYPES = [
  { key: "corporate_dinner", label: "Corporate dinner" },
  { key: "birthday", label: "Birthday" },
  { key: "rehearsal_dinner", label: "Rehearsal dinner" },
  { key: "networking", label: "Networking event" },
  { key: "fantasy_draft", label: "Fantasy football draft" },
  { key: "baby_shower", label: "Baby shower" },
  { key: "bridal_shower", label: "Bridal shower" },
  { key: "board_meeting", label: "Board meeting" },
  { key: "alumni", label: "Alumni gathering" },
  { key: "holiday_party", label: "Holiday party" },
  { key: "presentation", label: "Presentation" },
  { key: "club_meeting", label: "Club meeting" },
  { key: "bible_study", label: "Bible study / small group" },
  { key: "private_dinner", label: "Private dinner" },
  { key: "engagement", label: "Engagement party" },
  { key: "retirement", label: "Retirement" },
  { key: "graduation", label: "Graduation" },
  { key: "team_offsite", label: "Team offsite" },
  { key: "wine_dinner", label: "Wine dinner" },
  { key: "cocktail_party", label: "Cocktail party" },
  { key: "other", label: "Other" },
] as const satisfies readonly Option[];
export type EventTypeKey = (typeof EVENT_TYPES)[number]["key"];

export const CUISINES = [
  { key: "american", label: "American" },
  { key: "steakhouse", label: "Steakhouse" },
  { key: "italian", label: "Italian" },
  { key: "mexican", label: "Mexican" },
  { key: "tex_mex", label: "Tex-Mex" },
  { key: "seafood", label: "Seafood" },
  { key: "french", label: "French" },
  { key: "japanese", label: "Japanese" },
  { key: "sushi", label: "Sushi" },
  { key: "indian", label: "Indian" },
  { key: "mediterranean", label: "Mediterranean" },
  { key: "cajun_creole", label: "Cajun / Creole" },
  { key: "southern", label: "Southern" },
  { key: "bbq", label: "BBQ" },
  { key: "asian_fusion", label: "Asian fusion" },
  { key: "latin", label: "Latin American" },
  { key: "spanish", label: "Spanish" },
  { key: "chinese", label: "Chinese" },
  { key: "vietnamese", label: "Vietnamese" },
  { key: "thai", label: "Thai" },
  { key: "contemporary", label: "Contemporary" },
  { key: "gastropub", label: "Gastropub" },
  { key: "wine_bar", label: "Wine bar" },
  { key: "greek", label: "Greek" },
  { key: "deli", label: "Deli" },
] as const satisfies readonly Option[];
export type CuisineKey = (typeof CUISINES)[number]["key"];

export const SPACE_TYPES = [
  { key: "private_dining_room", label: "Private dining room" },
  { key: "semi_private_room", label: "Semi-private room" },
  { key: "patio", label: "Patio" },
  { key: "rooftop", label: "Rooftop" },
  { key: "wine_room", label: "Wine room" },
  { key: "chefs_table", label: "Chef's table" },
  { key: "bar_lounge", label: "Bar / lounge" },
  { key: "dining_section", label: "Enclosed dining section" },
  { key: "upstairs_room", label: "Upstairs room" },
  { key: "event_room", label: "Event room" },
  { key: "full_buyout", label: "Full restaurant buyout" },
  { key: "other", label: "Other" },
] as const satisfies readonly Option[];

export const PRIVACY_LEVELS = [
  { key: "fully_private", label: "Fully private", hint: "Your own room with a door" },
  { key: "semi_private", label: "Semi-private", hint: "Your own area, partially open" },
  { key: "shared", label: "Shared / open", hint: "Reserved section of the dining room" },
  { key: "buyout", label: "Buyout", hint: "The whole restaurant" },
] as const satisfies readonly Option[];

export const INDOOR_OUTDOOR = [
  { key: "indoor", label: "Indoor" },
  { key: "outdoor", label: "Outdoor" },
  { key: "covered_outdoor", label: "Covered outdoor" },
  { key: "mixed", label: "Indoor + outdoor" },
] as const satisfies readonly Option[];

export const SOURCE_TYPES = [
  { key: "restaurant_website", label: "Restaurant website" },
  { key: "private_dining_pdf", label: "Private dining PDF" },
  { key: "phone_confirmation", label: "Phone confirmation" },
  { key: "email_confirmation", label: "Email confirmation" },
  { key: "restaurant_claimed", label: "Restaurant-claimed listing" },
  { key: "public_listing", label: "Public listing" },
  { key: "red_rope_research", label: "Red Rope research" },
  { key: "csv_import", label: "CSV import" },
  { key: "ai_extraction", label: "AI extraction" },
  { key: "manual_entry", label: "Manual entry" },
] as const satisfies readonly Option[];

export const CONFIDENCE_LEVELS = [
  { key: "verified", label: "Verified", hint: "Confirmed directly with the restaurant" },
  { key: "publicly_listed", label: "Publicly listed", hint: "From the restaurant's own materials" },
  { key: "estimate", label: "Red Rope estimate", hint: "Our best estimate — confirm before booking" },
  { key: "unknown", label: "Unknown" },
] as const satisfies readonly Option[];

/** SEO occasion pages: /[city]/[occasionSlug]. Each maps to suitable_for keys. */
export const OCCASION_PAGES: {
  slug: string;
  title: string;
  eventTypes: EventTypeKey[];
  privacy?: ("fully_private" | "semi_private" | "shared" | "buyout")[];
  spaceTypes?: string[];
  intro: string;
}[] = [
  {
    slug: "private-dining",
    title: "Private dining rooms",
    eventTypes: [],
    privacy: ["fully_private", "buyout"],
    intro: "Fully private rooms inside restaurants — your own door, your own staff.",
  },
  {
    slug: "corporate-dinners",
    title: "Corporate dinners",
    eventTypes: ["corporate_dinner", "team_offsite", "board_meeting"],
    intro: "Client dinners, team celebrations and offsites in restaurant spaces built for groups.",
  },
  {
    slug: "birthday-dinners",
    title: "Birthday dinners",
    eventTypes: ["birthday"],
    intro: "Spaces that welcome cakes, toasts and a little noise.",
  },
  {
    slug: "rehearsal-dinners",
    title: "Rehearsal dinners",
    eventTypes: ["rehearsal_dinner", "engagement"],
    intro: "The night before the wedding, somewhere memorable.",
  },
  {
    slug: "holiday-parties",
    title: "Holiday parties",
    eventTypes: ["holiday_party"],
    intro: "Book early — the best rooms go months ahead.",
  },
  {
    slug: "baby-showers",
    title: "Baby & bridal showers",
    eventTypes: ["baby_shower", "bridal_shower"],
    intro: "Daytime-friendly rooms with brunch and lunch options.",
  },
  {
    slug: "networking-events",
    title: "Networking & cocktail events",
    eventTypes: ["networking", "cocktail_party"],
    intro: "Standing receptions, private bars and lounges.",
  },
  {
    slug: "meetings-and-presentations",
    title: "Meetings & presentations",
    eventTypes: ["board_meeting", "presentation", "club_meeting", "bible_study"],
    intro: "Rooms with screens, projectors and a quiet door.",
  },
  {
    slug: "patios-and-rooftops",
    title: "Patios & rooftops",
    eventTypes: [],
    spaceTypes: ["patio", "rooftop"],
    intro: "Outdoor and covered spaces for groups.",
  },
];

export function labelFor(options: readonly Option[], key: string | null | undefined): string {
  if (!key) return "";
  return options.find((o) => o.key === key)?.label ?? key.replace(/_/g, " ");
}
