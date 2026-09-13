/**
 * Houston market definition: city + neighborhoods (with aliases used by the
 * concierge and CSV importer). Inventory itself is imported from CSV research.
 */
import type { SeedCity } from "./types";

export const houston: SeedCity = {
  slug: "houston",
  name: "Houston",
  state: "TX",
  timezone: "America/Chicago",
  lat: 29.7604,
  lng: -95.3698,
  defaultTaxPct: 8.25,

  neighborhoods: [
    {
      slug: "downtown",
      name: "Downtown",
      aliases: ["dt", "central business district", "greenstreet", "green street", "theater district"],
      lat: 29.7589,
      lng: -95.3677,
      description: "Theater District, Discovery Green and the hotel core; strong for corporate dinners.",
    },
    { slug: "midtown", name: "Midtown", lat: 29.7405, lng: -95.379 },
    { slug: "montrose", name: "Montrose", lat: 29.743, lng: -95.396 },
    { slug: "river-oaks", name: "River Oaks", lat: 29.753, lng: -95.42 },
    {
      slug: "galleria",
      name: "Galleria",
      aliases: ["uptown", "post oak", "uptown park", "galleria area"],
      lat: 29.739,
      lng: -95.463,
      description: "Uptown / Post Oak: the densest cluster of steakhouses and hotel-adjacent private dining.",
    },
    { slug: "the-heights", name: "The Heights", aliases: ["heights", "houston heights"], lat: 29.793, lng: -95.399 },
    { slug: "east-downtown", name: "East Downtown", aliases: ["eado"], lat: 29.75, lng: -95.345 },
    { slug: "museum-district", name: "Museum District", lat: 29.725, lng: -95.386 },
    { slug: "rice-village", name: "Rice Village", aliases: ["west university", "west u"], lat: 29.717, lng: -95.416 },
    { slug: "upper-kirby", name: "Upper Kirby", lat: 29.735, lng: -95.421 },
    {
      slug: "memorial",
      name: "Memorial",
      aliases: ["memorial city", "city centre", "citycentre", "memorial area"],
      lat: 29.782,
      lng: -95.545,
    },
    { slug: "washington-avenue", name: "Washington Avenue", aliases: ["washington corridor", "washington ave", "heights-washington", "washington avenue"], lat: 29.77, lng: -95.395 },
    { slug: "medical-center", name: "Medical Center", aliases: ["tmc", "texas medical center"], lat: 29.708, lng: -95.398 },
    { slug: "the-woodlands", name: "The Woodlands", lat: 30.1658, lng: -95.4613 },
    { slug: "sugar-land", name: "Sugar Land", lat: 29.596, lng: -95.625 },
    { slug: "energy-corridor", name: "Energy Corridor", lat: 29.78, lng: -95.635 },
  ],

  // Inventory is imported from data/imports/houston-venues.csv (see src/db/seed.ts).
  restaurants: [],
};
