// @ts-expect-error cloudflare:workers has no type definitions
import { env } from "cloudflare:workers";
import { isValidDate, diffHours } from "@/app/_lib/date";

export async function PATCH(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      date?: string;
      clock_in?: string;
      clock_out?: string;
    };

    const { date, clock_in, clock_out } = body;

    if (!date || !isValidDate(date)) {
      return Response.json({ error: "invalid date" }, { status: 400 });
    }

    const existing = await env.DB.prepare(
      "SELECT clock_in, clock_out FROM attendance WHERE date = ?",
    )
      .bind(date)
      .first<{ clock_in: string | null; clock_out: string | null }>();

    // 記録がない場合は新規作成
    if (!existing) {
      await env.DB.prepare(
        `INSERT INTO attendance (date, clock_in, clock_out, hours) VALUES (?, ?, ?, ?)`,
      )
        .bind(date, clock_in, clock_out, null)
        .run();
    }

    const newClockIn = clock_in ?? existing?.clock_in ?? null;
    const newClockOut = clock_out ?? existing?.clock_out ?? null;

    let hours: number | null = null;
    if (newClockIn && newClockOut) {
      hours = diffHours(newClockIn, newClockOut);
    }

    await env.DB.prepare(
      `UPDATE attendance SET clock_in = ?, clock_out = ?, hours = ? WHERE date = ?`,
    )
      .bind(newClockIn, newClockOut, hours, date)
      .run();

    return Response.json({
      date,
      clock_in: newClockIn,
      clock_out: newClockOut,
      hours,
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "unknown error";
    return Response.json({ error: errorMsg }, { status: 500 });
  }
}
