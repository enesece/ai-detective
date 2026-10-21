import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { CaseContent } from "@/components/admin/CaseContent";
import { ChecksPanel } from "@/components/admin/ChecksPanel";
import { Section } from "@/components/admin/Section";
import { PageFallback } from "@/components/ui/PageFallback";
import { approveCase, recheckCase, rejectCase, scheduleCase } from "@/server/admin/actions";
import { getAdminCase } from "@/server/admin/data";
import { utcToday } from "@/server/cases/repository";
import { adminOrRedirect } from "../../guard";

// "Recheck" runs the blind solver; give the page's Server Actions room.
export const maxDuration = 300;

async function CaseDetail({ params }: PageProps<"/[locale]/admin/cases/[id]">) {
  await adminOrRedirect();
  const { id } = await params;
  const c = await getAdminCase(id);
  if (!c) notFound();
  const today = utcToday();
  const suspectName = (sid: string) => c.briefing?.suspects.find((s) => s.id === sid)?.name ?? sid;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-muted text-sm">
          {c.status === "approved"
            ? `Case #${c.caseNumber} · ${c.publishDate ?? "in pool"}`
            : "Draft"}{" "}
          · <span className="capitalize">{c.difficulty}</span> · created{" "}
          {c.createdAt.slice(0, 16).replace("T", " ")}
        </p>
        <h1 className="font-display text-2xl font-bold">{c.title.en}</h1>
        <p className="text-muted">{c.title.tr}</p>
      </header>

      {c.status === "draft" && (
        <Section title="Decide">
          <div className="grid gap-6 md:grid-cols-3">
            <ActionForm
              action={approveCase}
              submitLabel="Approve"
              confirmText="Approve this case? It gets the next case number."
            >
              <input type="hidden" name="caseId" value={c.id} />
              <label className="block text-sm">
                Publish on (optional, UTC)
                <input
                  type="date"
                  name="publishDate"
                  min={today}
                  className="border-rule mt-1 block rounded border bg-white px-2 py-1.5"
                />
              </label>
            </ActionForm>
            <ActionForm action={rejectCase} submitLabel="Reject" tone="danger">
              <input type="hidden" name="caseId" value={c.id} />
              <textarea
                name="notes"
                rows={2}
                maxLength={2000}
                placeholder="Why? (optional)"
                className="border-rule block w-full rounded border bg-white px-2 py-1.5 text-sm"
              />
            </ActionForm>
            <ActionForm
              action={recheckCase}
              submitLabel="Run checks again"
              pendingLabel="Checking…"
              tone="plain"
            >
              <input type="hidden" name="caseId" value={c.id} />
              <p className="text-muted text-xs">
                Logic checks + blind solver, saved as a new review.
              </p>
            </ActionForm>
          </div>
        </Section>
      )}

      {c.status === "approved" && c.publishDate === null && (
        <Section title="Schedule">
          <ActionForm
            action={scheduleCase}
            submitLabel="Schedule"
            className="flex items-end gap-2 space-y-0"
          >
            <input type="hidden" name="caseId" value={c.id} />
            <input
              type="date"
              name="publishDate"
              min={today}
              required
              className="border-rule rounded border bg-white px-2 py-1.5"
            />
          </ActionForm>
        </Section>
      )}

      {c.review && (
        <Section title="Latest review">
          <ChecksPanel review={c.review} suspectName={suspectName} />
        </Section>
      )}
      {c.reviews.length > 1 && (
        <details className="border-rule bg-card rounded-lg border p-4">
          <summary className="cursor-pointer font-semibold">
            Earlier reviews ({c.reviews.length - 1})
          </summary>
          <div className="mt-4 space-y-6">
            {c.reviews.slice(1).map((r) => (
              <ChecksPanel key={r.id} review={r} suspectName={suspectName} />
            ))}
          </div>
        </details>
      )}

      {c.briefing && c.secret ? (
        <CaseContent briefing={c.briefing} secret={c.secret} />
      ) : (
        <p className="text-alert">The stored case doesn&apos;t match the schema: {c.parseError}</p>
      )}
    </div>
  );
}

export default function AdminCasePage(props: PageProps<"/[locale]/admin/cases/[id]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <CaseDetail {...props} />
    </Suspense>
  );
}
