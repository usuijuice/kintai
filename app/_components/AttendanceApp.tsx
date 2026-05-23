"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AttendanceRow } from "@/app/_lib/db";

type MonthResponse = {
  month: string;
  today: string;
  records: AttendanceRow[];
};

type EditingRecord = {
  date: string;
  clock_in: string | null;
  clock_out: string | null;
};

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const ny = d.getUTCFullYear();
  const nm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${ny}-${nm}`;
}

function buildCalendarCells(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: string[] = [];
  for (let i = 0; i < firstDow; i++) cells.push("");
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  return cells;
}

export function AttendanceApp({ initialMonth }: { initialMonth: string }) {
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<MonthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingRecord | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchMonth = useCallback(async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance?month=${m}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as MonthResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMonth(month);
  }, [month, fetchMonth]);

  const recordsByDate = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    for (const r of data?.records ?? []) map.set(r.date, r);
    return map;
  }, [data]);

  const today = data?.today ?? initialMonth + "-01";
  const todayRecord = recordsByDate.get(today);
  const status: "not_yet" | "working" | "done" = !todayRecord?.clock_in
    ? "not_yet"
    : todayRecord.clock_out
      ? "done"
      : "working";

  const handleClockIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/attendance/clock-in", { method: "POST" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      await fetchMonth(today.slice(0, 7));
      setMonth(today.slice(0, 7));
    } catch (e) {
      setError(e instanceof Error ? e.message : "clock-in failed");
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/attendance/clock-out", { method: "POST" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      await fetchMonth(today.slice(0, 7));
      setMonth(today.slice(0, 7));
    } catch (e) {
      setError(e instanceof Error ? e.message : "clock-out failed");
      setLoading(false);
    }
  };

  const handleEditStart = (dateStr: string) => {
    const rec = recordsByDate.get(dateStr);
    setEditing({
      date: dateStr,
      clock_in: rec?.clock_in ?? null,
      clock_out: rec?.clock_out ?? null,
    });
    setEditError(null);
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setLoading(true);
    setEditError(null);
    try {
      const res = await fetch("/api/attendance/edit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: editing.date,
          clock_in: editing.clock_in,
          clock_out: editing.clock_out,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      await fetchMonth(month);
      setEditing(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm("この勤怠記録を削除しますか？")) return;
    setLoading(true);
    setEditError(null);
    try {
      const res = await fetch("/api/attendance/edit", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editing.date }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      await fetchMonth(month);
      setEditing(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "delete failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEditCancel = () => {
    setEditing(null);
    setEditError(null);
  };

  const handleEditChange = (field: "clock_in" | "clock_out", value: string) => {
    if (editing) {
      setEditing({
        ...editing,
        [field]: value,
      });
    }
  };

  const cells = buildCalendarCells(month);
  const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

  const monthlyTotal = (data?.records ?? []).reduce((s, r) => s + (r.hours ?? 0), 0);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">勤怠記録</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">今日: {today}</p>
      </header>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">本日の状態</span>
          <span className="text-lg font-semibold">
            {status === "not_yet" && "未出勤"}
            {status === "working" && `勤務中 (出勤 ${formatTime(todayRecord?.clock_in ?? null)})`}
            {status === "done" &&
              `退勤済 ${formatTime(todayRecord?.clock_in ?? null)} 〜 ${formatTime(
                todayRecord?.clock_out ?? null,
              )} (${(todayRecord?.hours ?? 0).toFixed(2)}h)`}
          </span>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClockIn}
            disabled={loading || status !== "not_yet"}
            className="flex-1 h-12 rounded-full bg-blue-600 text-white font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
          >
            出勤
          </button>
          <button
            type="button"
            onClick={handleClockOut}
            disabled={loading || status !== "working"}
            className="flex-1 h-12 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            退勤
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="px-3 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ←
          </button>
          <h2 className="text-lg font-semibold">{month}</h2>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="px-3 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500 dark:text-zinc-400">
          {weekdayLabels.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} className="aspect-square" />;
            const rec = recordsByDate.get(cell);
            const day = Number(cell.slice(-2));
            const isToday = cell === today;
            return (
              <div
                key={cell}
                className={`aspect-square rounded-md border p-1 flex flex-col text-xs ${
                  isToday
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <span className="text-zinc-500 dark:text-zinc-400">{day}</span>
                {rec?.hours != null && (
                  <span className="mt-auto font-semibold text-right">{rec.hours.toFixed(1)}h</span>
                )}
                {rec?.clock_in && rec.hours == null && (
                  <span className="mt-auto text-right text-blue-600">勤務中</span>
                )}
                <button
                  type="button"
                  onClick={() => handleEditStart(cell)}
                  className="mt-auto text-blue-600 hover:underline text-xs"
                >
                  編集
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">
            月合計:{" "}
            <span className="font-semibold text-black dark:text-white">
              {monthlyTotal.toFixed(1)}h
            </span>
          </span>
        </div>
      </section>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-sm flex flex-col gap-4">
            <h3 className="text-lg font-semibold">{editing.date} の時間を編集</h3>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">出勤時間</label>
              <input
                type="time"
                value={
                  editing.clock_in
                    ? new Date(editing.clock_in).toLocaleTimeString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })
                    : ""
                }
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":").map(Number);
                  if (editing.clock_in) {
                    const date = new Date(editing.clock_in);
                    date.setHours(h, m, 0, 0);
                    handleEditChange("clock_in", date.toISOString());
                  } else {
                    // 新規作成時：編集日付の日付を基準に作成
                    const date = new Date(`${editing.date}T00:00:00`);
                    date.setHours(h, m, 0, 0);
                    handleEditChange("clock_in", date.toISOString());
                  }
                }}
                className="px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">退勤時間</label>
              <input
                type="time"
                value={
                  editing.clock_out
                    ? new Date(editing.clock_out).toLocaleTimeString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })
                    : ""
                }
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":").map(Number);
                  if (editing.clock_out) {
                    const date = new Date(editing.clock_out);
                    date.setHours(h, m, 0, 0);
                    handleEditChange("clock_out", date.toISOString());
                  } else {
                    // 新規作成時：編集日付の日付を基準に作成
                    const date = new Date(`${editing.date}T00:00:00`);
                    date.setHours(h, m, 0, 0);
                    handleEditChange("clock_out", date.toISOString());
                  }
                }}
                className="px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-800 dark:text-white"
              />
            </div>

            {editError && <p className="text-sm text-red-600">{editError}</p>}

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={handleEditCancel}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
              >
                削除
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
