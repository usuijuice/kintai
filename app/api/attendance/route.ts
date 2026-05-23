// @ts-expect-error cloudflare:workers has no type definitions
import { env } from "cloudflare:workers";
import type { AttendanceRow } from "@/app/_lib/db";
import { currentMonthInTZ, isValidMonth, todayInTZ } from "@/app/_lib/date";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? currentMonthInTZ();

  if (!isValidMonth(month)) {
    return Response.json({ error: "invalid month" }, { status: 400 });
  }

  const result = await env.DB.prepare(
    `SELECT date, clock_in, clock_out, hours FROM attendance
     WHERE date LIKE ? ORDER BY date ASC`,
  )
    .bind(`${month}-%`)
    .all<AttendanceRow>();

  return Response.json({ month, today: todayInTZ(), records: result.results ?? [] });
}
