import type { Appearance } from "./schema";

/*
 * The traits a portrait is drawn from. Cases written before portraits had no
 * `appearance`; for those the traits are picked from a hash of the suspect id,
 * so every suspect still gets the same, distinct face on every page.
 */

/** Small, stable string hash (FNV-1a), the same on server and client. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(options: readonly T[], seed: number, salt: number): T {
  const value = options[(seed >>> (salt * 3)) % options.length];
  if (value === undefined) throw new Error("pick() needs at least one option");
  return value;
}

export function resolveAppearance(seed: string, appearance?: Appearance): Appearance {
  if (appearance) return appearance;
  const h = hash(seed);
  const sex = pick(["female", "male"] as const, h, 0);
  return {
    sex,
    age: pick(["young", "middle", "old"] as const, h, 1),
    hair:
      sex === "female"
        ? pick(["long", "bun", "curly"] as const, h, 2)
        : pick(["short", "curly", "bald"] as const, h, 2),
    hairColor: pick(["dark", "fair", "grey"] as const, h, 3),
    headwear: "none",
    glasses: h % 5 === 0,
    facialHair: sex === "male" ? pick(["none", "moustache", "beard"] as const, h, 4) : "none",
    attire:
      sex === "female"
        ? pick(["dress", "coat"] as const, h, 5)
        : pick(["suit", "coat", "casual"] as const, h, 5),
  };
}
