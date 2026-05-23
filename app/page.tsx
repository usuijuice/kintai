import { AttendanceApp } from "@/app/_components/AttendanceApp";
import { currentMonthInTZ } from "@/app/_lib/date";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-black dark:text-zinc-50 font-sans">
      <AttendanceApp initialMonth={currentMonthInTZ()} />
    </div>
  );
}
