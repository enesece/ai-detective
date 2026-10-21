import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { ensureTodayHasCase } from "@/server/cases/publish";

/*
 * Daily job, called by Vercel Cron (see vercel.json) shortly after midnight UTC.
 * Vercel sends "Authorization: Bearer <CRON_SECRET>"; anyone else gets 401.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await ensureTodayHasCase();
  // A new day: cached "today's case" and case lists must be read again now.
  revalidateTag("schedule", { expire: 0 });
  revalidateTag("cases", { expire: 0 });
  console.log("cron/publish", JSON.stringify(result));
  return Response.json(result);
}

function isAuthorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  // Constant-time comparison, so the secret can't be guessed from response times.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
