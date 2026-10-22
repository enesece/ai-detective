import { renderMonogram } from "@/server/og/monogram";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Browser tab icon (generated at build time). */
export default function Icon() {
  return renderMonogram(size.width);
}
