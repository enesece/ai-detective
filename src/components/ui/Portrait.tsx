import { resolveAppearance } from "@/lib/case/appearance";
import type { Appearance } from "@/lib/case/schema";

/*
 * A suspect's portrait as a newspaper engraving, drawn in SVG from a few
 * visual traits (no image files, no AI images: free and crisp at any size).
 * Layers, back to front: hatched plate, hair behind the head, neck, clothes,
 * head, face, hair in front, beard, glasses, hat, frame.
 * Pure: renders the same in Server and Client Components.
 */

type Props = {
  name: string;
  /** Suspect id: picks traits for old cases without `appearance` and names the SVG patterns. */
  seed: string;
  appearance?: Appearance;
  /** "bust" for cards; "head" zooms in for small thumbnails. */
  crop?: "bust" | "head";
  className?: string;
};

const INK = "var(--color-ink)";
const PAPER = "#ece4d3";
const SKIN = "#f2eadb";
const HAIR = { dark: "#2a241e", fair: "#a88f62", grey: "#9b958b" } as const;
const CLOTH = {
  suit: "#2a241e",
  coat: "#3b342c",
  uniform: "#22201c",
  dress: "#6f6455",
  casual: "#857a69",
};

export function Portrait({ name, seed, appearance, crop = "bust", className = "" }: Props) {
  const a = resolveAppearance(seed, appearance);
  const id = `p-${seed.replace(/[^a-z0-9-]/gi, "")}`;
  const female = a.sex === "female";
  const hair = HAIR[a.hairColor];
  const headRx = female ? 17.5 : 19;

  return (
    <svg
      viewBox={crop === "head" ? "27 16 66 66" : "0 0 120 150"}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={name}
      className={`border-ink block border ${className}`}
    >
      <defs>
        <pattern
          id={`${id}-hatch`}
          width="3"
          height="3"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="3" stroke={INK} strokeWidth="0.7" strokeOpacity="0.35" />
        </pattern>
        <pattern
          id={`${id}-shade`}
          width="2.4"
          height="2.4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-35)"
        >
          <line x1="0" y1="0" x2="0" y2="2.4" stroke={INK} strokeWidth="0.5" strokeOpacity="0.28" />
        </pattern>
        <clipPath id={`${id}-head`}>
          <ellipse cx="60" cy="70" rx={headRx} ry="24" />
        </clipPath>
      </defs>

      {/* Plate: light oval vignette on a hatched ground. */}
      <rect width="120" height="150" fill={PAPER} />
      <path
        d="M0 0H120V150H0Z M60 8 a52 66 0 1 0 0.01 0Z"
        fill={`url(#${id}-hatch)`}
        fillRule="evenodd"
      />

      {/* The figure, enlarged from the bottom centre so the bust fills the oval. */}
      <g transform="translate(60 150) scale(1.15) translate(-60 -150)">
        {/* Long hair falls behind the shoulders. */}
        {a.hair === "long" && a.headwear !== "cap" && (
          <path
            d="M38 70 C35 44 48 37 60 37 C73 37 85 45 82 70 L85 110 Q73 116 67 104 L53 104 Q47 116 35 110 Z"
            fill={hair}
          />
        )}

        {/* Neck, behind the collar */}
        <path d="M52 96 L51 118 Q60 122 69 118 L68 96 Z" fill={SKIN} stroke={INK} strokeWidth="1" />
        <path d="M52 104 Q60 109 68 104 L68 96 L52 96 Z" fill={`url(#${id}-shade)`} />

        <Clothes attire={a.attire} />

        {/* Ears (hidden under long hair) */}
        {a.hair !== "long" && !(female && a.hair === "short") && (
          <>
            <ellipse
              cx={60 - headRx}
              cy="72"
              rx="3"
              ry="5"
              fill={SKIN}
              stroke={INK}
              strokeWidth="1"
            />
            <ellipse
              cx={60 + headRx}
              cy="72"
              rx="3"
              ry="5"
              fill={SKIN}
              stroke={INK}
              strokeWidth="1"
            />
          </>
        )}

        {/* Head, shaded on the right like a lit engraving */}
        <ellipse cx="60" cy="70" rx={headRx} ry="24" fill={SKIN} stroke={INK} strokeWidth="1.2" />
        <g clipPath={`url(#${id}-head)`}>
          <rect x="64" y="44" width="20" height="52" fill={`url(#${id}-shade)`} />
        </g>

        <Face female={female} age={a.age} />
        <Hair kind={a.hair} color={hair} female={female} hidden={a.headwear === "cap"} />

        {a.facialHair === "beard" && (
          <path
            d="M42 74 Q43 99 60 101 Q77 99 78 74 Q74 91 60 93 Q46 91 42 74 Z"
            fill={hair}
            stroke={INK}
            strokeWidth="0.8"
          />
        )}
        {a.facialHair !== "none" && (
          <path
            d="M52 83 Q60 79 68 83 Q60 86.5 52 83 Z"
            fill={hair}
            stroke={INK}
            strokeWidth="0.6"
          />
        )}

        {a.glasses && (
          <g fill="none" stroke={INK} strokeWidth="1.1">
            <circle cx="53" cy="69" r="5" />
            <circle cx="67" cy="69" r="5" />
            <path d="M58 69 Q60 67.5 62 69 M48 68 L42 66 M72 68 L78 66" />
          </g>
        )}

        <Headwear kind={a.headwear} female={female} />
      </g>

      {/* Engraving frame */}
      <ellipse
        cx="60"
        cy="74"
        rx="52"
        ry="66"
        fill="none"
        stroke={INK}
        strokeWidth="0.8"
        strokeOpacity="0.6"
      />
    </svg>
  );
}

function Clothes({ attire }: { attire: Appearance["attire"] }) {
  const body = "M12 150 C14 126 32 115 48 112 L72 112 C88 115 106 126 108 150 Z";
  const fill = CLOTH[attire];
  return (
    <g stroke={INK} strokeWidth="1">
      <path d={body} fill={fill} />
      {attire === "suit" && (
        <>
          <path d="M49 112 L60 134 L71 112 Z" fill={PAPER} />
          <path d="M58 116 L62 116 L63.5 133 L60 138 L56.5 133 Z" fill="#5b5246" />
          <path d="M48 112 L56 134 L44 124 Z M72 112 L64 134 L76 124 Z" fill="#3b342c" />
        </>
      )}
      {attire === "dress" && <path d="M45 114 Q60 131 75 114 Z" fill={SKIN} />}
      {attire === "uniform" && (
        <>
          <path d="M48 112 Q60 120 72 112 L72 118 Q60 126 48 118 Z" fill="#3b342c" />
          {[126, 134, 142].map((y) => (
            <circle key={y} cx="60" cy={y} r="1.6" fill={PAPER} />
          ))}
        </>
      )}
      {attire === "coat" && (
        <>
          <path d="M50 112 L60 128 L70 112 Z" fill={PAPER} />
          <path d="M47 111 L58 132 L36 126 Z M73 111 L62 132 L84 126 Z" fill="#544a3e" />
        </>
      )}
      {attire === "casual" && <path d="M52 112 L60 124 L68 112 Z" fill={SKIN} />}
    </g>
  );
}

function Face({ female, age }: { female: boolean; age: Appearance["age"] }) {
  return (
    <g fill="none" stroke={INK} strokeLinecap="round">
      {/* Brows */}
      <path
        d="M48.5 63 Q53 60.5 57 62.5 M63 62.5 Q67 60.5 71.5 63"
        strokeWidth={female ? 1 : 1.5}
      />
      {/* Eyes */}
      <path d="M50.5 69 Q53 67 55.5 69 M64.5 69 Q67 67 69.5 69" strokeWidth="1" />
      <circle cx="53" cy="69.3" r="1.2" fill={INK} stroke="none" />
      <circle cx="67" cy="69.3" r="1.2" fill={INK} stroke="none" />
      {female && <path d="M50.3 68.6 L48.8 67.4 M69.7 68.6 L71.2 67.4" strokeWidth="0.8" />}
      {/* Nose and mouth */}
      <path d="M60 69 L57.8 78.5 Q60 80.5 62.4 79" strokeWidth="1" />
      <path
        d={female ? "M54.5 86.5 Q60 90 65.5 86.5" : "M55 86.5 Q60 88.5 65 86.5"}
        strokeWidth={female ? 1.5 : 1.1}
      />
      {female && <path d="M56.5 86 Q60 84.8 63.5 86" strokeWidth="0.7" />}
      {age !== "young" && (
        <path d="M54 79 Q52 84 54 88 M66 79 Q68 84 66 88" strokeWidth="0.6" strokeOpacity="0.7" />
      )}
      {age === "old" && (
        <path
          d="M51 55.5 Q60 53.5 69 55.5 M52 58.5 Q60 57 68 58.5 M47 71 L45 73 M73 71 L75 73"
          strokeWidth="0.6"
          strokeOpacity="0.8"
        />
      )}
    </g>
  );
}

function Hair({
  kind,
  color,
  female,
  hidden,
}: {
  kind: Appearance["hair"];
  color: string;
  female: boolean;
  hidden: boolean;
}) {
  if (hidden) return null;
  const stroke = { stroke: INK, strokeWidth: 0.8 };
  switch (kind) {
    case "short":
      // Women get a 1930s bob down to the jaw; men a short crop.
      if (female) {
        return (
          <path
            d="M39 83 C35 50 47 40.5 60 40.5 C73 40.5 85 50 81 83 Q78.5 85.5 76 81 C77 64 71 54 60 54 C49 54 43 64 44 81 Q41.5 85.5 39 83 Z"
            fill={color}
            {...stroke}
          />
        );
      }
      return (
        <path
          d="M40.5 67 C38.5 47 49 41.5 60 41.5 C71 41.5 81.5 47 79.5 67 C77 57 70 52.5 60 52.5 C50 52.5 43.5 57 40.5 67 Z"
          fill={color}
          {...stroke}
        />
      );
    case "long":
      return (
        <path
          d="M41 66 C41 49 51 42.5 60 42.5 C70 42.5 79 49 79 66 C72 55 64 52 55 54.5 C49 56 44.5 60 41 66 Z"
          fill={color}
          {...stroke}
        />
      );
    case "bun":
      return (
        <>
          <circle cx="60" cy="40" r="8" fill={color} {...stroke} />
          <path
            d="M41 66 C40 48 50 43 60 43 C70 43 80 48 79 66 C76 56 69 52 60 52 C51 52 44 56 41 66 Z"
            fill={color}
            {...stroke}
          />
        </>
      );
    case "curly":
      return (
        <g fill={color} {...stroke}>
          {[
            [42, 62],
            [43, 53],
            [48, 46],
            [55, 42.5],
            [62, 42],
            [69, 44],
            [75, 49],
            [78, 57],
            [78.5, 64],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={female ? 5.5 : 5} />
          ))}
        </g>
      );
    case "bald":
      return (
        <path
          d="M41.5 74 C40.5 66 41 61 43 58 L45 66 Z M78.5 74 C79.5 66 79 61 77 58 L75 66 Z"
          fill={color}
          {...stroke}
        />
      );
  }
}

function Headwear({ kind, female }: { kind: Appearance["headwear"]; female: boolean }) {
  if (kind === "none") return null;
  if (kind === "cap") {
    return (
      <g stroke={INK} strokeWidth="1">
        <path d="M39.5 58 Q40 40 60 39 Q80 39.5 81 53 L89 57.5 Q72 53.5 39.5 58 Z" fill="#544a3e" />
        <path d="M44 50 Q60 45 78 49" fill="none" strokeOpacity="0.6" />
      </g>
    );
  }
  if (female) {
    // A cloche hat, pulled low.
    return (
      <g stroke={INK} strokeWidth="1">
        <path d="M37 62 Q36 35 60 35 Q84 35 83 62 Q60 55 37 62 Z" fill="#2a241e" />
        <path d="M40 55 Q60 49 80 55" fill="none" stroke="#857a69" strokeWidth="2.2" />
      </g>
    );
  }
  // A fedora.
  return (
    <g stroke={INK} strokeWidth="1">
      <ellipse cx="60" cy="50" rx="31" ry="5.5" fill="#2a241e" />
      <path d="M43.5 50 Q42.5 29 60 29 Q77.5 29 76.5 50 Z" fill="#2a241e" />
      <path d="M60 30 L60 37" stroke="#857a69" strokeWidth="1" />
      <rect x="43.8" y="43" width="32.4" height="4" fill="#857a69" />
    </g>
  );
}
