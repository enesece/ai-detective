import { renderMonogram } from "@/server/og/monogram";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon on iPhone and iPad. */
export default function AppleIcon() {
  return renderMonogram(size.width);
}
