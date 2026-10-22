import { Suspense } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageFallback } from "@/components/ui/PageFallback";
import { Link } from "@/i18n/navigation";
import { scheduleCase, unscheduleDay } from "@/server/admin/actions";
import { getUpcomingSchedule, listCases } from "@/server/admin/data";
import { utcToday } from "@/server/cases/repository";
import { adminOrRedirect } from "../guard";

const DAYS = 14;
const LOW_STOCK_DAYS = 3;

async function ScheduleContent() {
  await adminOrRedirect();
  const [days, rows] = await Promise.all([getUpcomingSchedule(DAYS), listCases()]);
  const pool = rows.filter((r) => r.status === "approved" && r.publishDate === null);
  const today = utcToday();
  // Days after today that already have a case, plus cases the daily job can still pick.
  const daysOfStock = days.filter((d) => d.date > today && d.entry).length + pool.length;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold">Schedule (UTC)</h1>

      <p
        role={daysOfStock < LOW_STOCK_DAYS ? "alert" : undefined}
        className={`rounded-lg border px-4 py-3 text-sm ${
          daysOfStock < LOW_STOCK_DAYS
            ? "border-alert text-alert font-semibold"
            : "border-rule bg-card"
        }`}
      >
        {daysOfStock === 1 ? "1 day" : `${daysOfStock} days`} of cases left after today.
        {daysOfStock < LOW_STOCK_DAYS && " Generate and approve a few more soon."}
      </p>

      <ul className="divide-rule border-rule bg-card divide-y rounded-lg border">
        {days.map((day) => (
          <li key={day.date} className="flex flex-wrap items-center gap-4 px-4 py-3">
            <span className="w-28 font-mono text-sm">{day.date}</span>
            {day.entry ? (
              <>
                <Link
                  href={`/admin/cases/${day.entry.caseId}`}
                  className="min-w-0 flex-1 hover:underline"
                >
                  #{day.entry.caseNumber} · {day.entry.title}
                </Link>
                {day.date > today && (
                  <ActionForm action={unscheduleDay} submitLabel="Free this day" tone="plain">
                    <input type="hidden" name="publishDate" value={day.date} />
                  </ActionForm>
                )}
              </>
            ) : (
              <span className="text-alert flex-1 text-sm">
                Empty: the daily job will use the oldest case in the pool.
              </span>
            )}
          </li>
        ))}
      </ul>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">
          Pool: approved, no day yet ({pool.length})
        </h2>
        {pool.length === 0 && (
          <p className="text-muted text-sm">Empty. Approve a few drafts to fill it.</p>
        )}
        {pool.map((row) => (
          <div
            key={row.id}
            className="border-rule bg-card flex flex-wrap items-end gap-4 rounded-lg border p-4"
          >
            <Link
              href={`/admin/cases/${row.id}`}
              className="min-w-0 flex-1 font-semibold hover:underline"
            >
              #{row.caseNumber} · {row.title.en}
            </Link>
            <ActionForm
              action={scheduleCase}
              submitLabel="Schedule"
              className="flex items-end gap-2 space-y-0"
            >
              <input type="hidden" name="caseId" value={row.id} />
              <input
                type="date"
                name="publishDate"
                min={today}
                required
                className="border-rule rounded border bg-white px-2 py-1.5"
              />
            </ActionForm>
          </div>
        ))}
      </section>
    </div>
  );
}

export default function AdminSchedulePage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ScheduleContent />
    </Suspense>
  );
}
