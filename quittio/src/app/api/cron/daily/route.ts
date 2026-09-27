import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { purgeExpiredAccounts, runDailyAutomation } from "@/lib/automation";

export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Déclenché chaque jour à 7 h UTC par Vercel Cron (voir vercel.json). */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const report = await runDailyAutomation();
  let purged = 0;
  try {
    purged = await purgeExpiredAccounts();
  } catch (e) {
    report.errors.push(`purge: ${e instanceof Error ? e.message : String(e)}`);
  }
  return NextResponse.json({ ...report, purged }, { status: report.errors.length ? 207 : 200 });
}
