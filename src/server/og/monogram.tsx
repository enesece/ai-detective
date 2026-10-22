import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/*
 * The site's icon: a paper-coloured "A" in the masthead typeface on an
 * ink-black square, with a thin paper rule near the edge like a printer's border.
 */

const PAPER = "#f3eee3";
const INK = "#17140f";

const abril = readFile(join(process.cwd(), "assets/fonts/AbrilFatface-Regular.ttf"));

export async function renderMonogram(px: number) {
  const inset = Math.max(2, Math.round(px * 0.07));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: INK,
        padding: inset,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // The border only shows on larger icons; at 32px it would be mud.
          border: px >= 64 ? `${Math.round(px / 64)}px solid ${PAPER}` : "none",
          color: PAPER,
          fontFamily: "Abril",
          fontSize: Math.round(px * 0.78),
          lineHeight: 1,
          paddingTop: Math.round(px * 0.06),
        }}
      >
        A
      </div>
    </div>,
    {
      width: px,
      height: px,
      fonts: [{ name: "Abril", data: await abril, style: "normal", weight: 400 }],
    },
  );
}
