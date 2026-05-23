// @ts-expect-error cloudflare:workers has no type definitions
import { env } from "cloudflare:workers";
import { diffHours, todayInTZ } from "@/app/_lib/date";

export async function POST(): Promise<Response> {
  const date = todayInTZ();
  const now = new Date().toISOString();

  const existing = await env.DB.prepare("SELECT clock_in, clock_out FROM attendance WHERE date = ?")
    .bind(date)
    .first<{ clock_in: string | null; clock_out: string | null }>();

  if (!existing?.clock_in) {
    return Response.json({ error: "not clocked in yet" }, { status: 400 });
  }

  const hours = diffHours(existing.clock_in, now);

  await env.DB.prepare("UPDATE attendance SET clock_out = ?, hours = ? WHERE date = ?")
    .bind(now, hours, date)
    .run();

  return Response.json({ date, clock_out: now, hours });
}
