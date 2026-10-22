import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/*
 * The link-preview image (1200×630) in the Evening Gazette style: a masthead,
 * a headline and a line of italic text. Only public text is ever passed in.
 */

export const OG_SIZE = { width: 1200, height: 630 };

const PAPER = "#f3eee3";
const INK = "#17140f";
const MUTED = "#5c554a";
const ACCENT = "#1f4d43";

const fonts = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/AbrilFatface-Regular.ttf")),
  readFile(join(process.cwd(), "assets/fonts/LibreCaslonText-Italic.ttf")),
]);

type Card = {
  brand: string;
  /** Small caps line above the headline, e.g. "Case #2 · Medium". */
  kicker: string;
  headline: string;
  /** Italic line under the headline. */
  standfirst: string;
};

export async function renderGazetteCard({ brand, kicker, headline, standfirst }: Card) {
  const [abril, caslonItalic] = await fonts;
  // Long titles get a smaller headline so they stay on two or three lines.
  const headlineSize = headline.length > 60 ? 62 : headline.length > 40 ? 76 : 96;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: PAPER,
        color: INK,
        padding: "48px 64px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          borderTop: `6px solid ${INK}`,
          padding: "14px 0 16px",
          fontFamily: "Abril",
          fontSize: 64,
        }}
      >
        {brand}
      </div>
      {/* A double rule, drawn as two lines (the renderer has no "double" border). */}
      <div style={{ display: "flex", borderTop: `3px solid ${INK}` }} />
      <div style={{ display: "flex", borderTop: `1px solid ${INK}`, marginTop: 4 }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flexGrow: 1,
        }}
      >
        <div
          style={{
            fontFamily: "Abril",
            fontSize: 28,
            letterSpacing: 4,
            color: ACCENT,
            textTransform: "uppercase",
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            fontFamily: "Abril",
            fontSize: headlineSize,
            lineHeight: 1.02,
            marginTop: 14,
          }}
        >
          {headline}
        </div>
        <div
          style={{
            fontFamily: "Caslon",
            fontStyle: "italic",
            fontSize: 34,
            color: MUTED,
            marginTop: 22,
          }}
        >
          {standfirst}
        </div>
      </div>
      <div style={{ display: "flex", borderTop: `2px solid ${INK}` }} />
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "Abril", data: abril, style: "normal", weight: 400 },
        { name: "Caslon", data: caslonItalic, style: "italic", weight: 400 },
      ],
    },
  );
}
