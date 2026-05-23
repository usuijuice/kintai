// @ts-expect-error cloudflare:workers has no type definitions
import { env } from "cloudflare:workers";
import { todayInTZ } from "@/app/_lib/date";

export async function POST(): Promise<Response> {
  const date = todayInTZ();
  const now = new Date().toISOString();

  const existing = await env.DB.prepare("SELECT clock_in FROM attendance WHERE date = ?")
    .bind(date)
    .first<{ clock_in: string | null }>();

  if (existing?.clock_in) {
    return Response.json(
      { error: "already clocked in", clock_in: existing.clock_in },
      { status: 409 },
    );
  }

  await env.DB.prepare(
    `INSERT INTO attendance (date, clock_in) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET clock_in = excluded.clock_in`,
  )
    .bind(date, now)
    .run();

  return Response.json({ date, clock_in: now });
}
