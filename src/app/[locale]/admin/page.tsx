import { Suspense } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { DecisionBadge } from "@/components/admin/ChecksPanel";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { PageFallback } from "@/components/ui/PageFallback";
import { Link } from "@/i18n/navigation";
import { generateCase } from "@/server/admin/actions";
import { listCases, type CaseRow } from "@/server/admin/data";
import { adminOrRedirect } from "./guard";

// Generating a case can take minutes; this raises the limit for the page's Server Actions.
export const maxDuration = 300;

const FILTERS = ["pending", "rejected", "approved", "all"] as const;
type Filter = (typeof FILTERS)[number];

function matches(row: CaseRow, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "approved") return row.status === "approved";
  return row.status === "draft" && (row.review?.decision ?? "pending") === filter;
}

async function CasesContent({ searchParams }: PageProps<"/[locale]/admin">) {
  const admin = await adminOrRedirect();
  const raw = (await searchParams).show;
  const filter: Filter = FILTERS.find((f) => f === raw) ?? "pending";
  const rows = await listCases();
  const visible = rows.filter((r) => matches(r, filter));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Cases</h1>
        <p className="text-muted text-sm">
          {admin.email} · <SignOutButton />
        </p>
      </div>

      <section className="border-rule bg-card rounded-lg border p-4">
        <h2 className="font-display mb-3 text-lg font-bold">Generate a new case</h2>
        <ActionForm
          action={generateCase}
          submitLabel="Generate"
          pendingLabel="Writing and checking… (up to 5 minutes)"
        >
          <div className="flex flex-wrap gap-3">
            <select
              name="difficulty"
              defaultValue="medium"
              className="border-rule rounded border bg-white px-3 py-2"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <input
              name="theme"
              placeholder="Theme (optional, random if empty)"
              maxLength={200}
              className="border-rule min-w-0 flex-1 rounded border bg-white px-3 py-2"
            />
          </div>
        </ActionForm>
        <p className="text-muted mt-2 text-xs">
          Uses the thinking model (about 20 calls a day on the free tier). On Vercel there&apos;s no
          time for a repair round; run <code>npm run generate</code> locally for that.
        </p>
      </section>

      <nav className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={{ pathname: "/admin", query: { show: f } }}
            className={`rounded px-3 py-1 capitalize ${f === filter ? "bg-ink text-paper" : "border-rule border"}`}
          >
            {f} ({rows.filter((r) => matches(r, f)).length})
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <p className="text-muted">Nothing here.</p>
      ) : (
        <ul className="divide-rule border-rule bg-card divide-y rounded-lg border">
          {visible.map((row) => (
            <li key={row.id}>
              <Link
                href={`/admin/cases/${row.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-white"
              >
                <span className="min-w-0 flex-1 font-semibold">
                  {row.caseNumber !== null && `#${row.caseNumber} · `}
                  {row.title.en}
                </span>
                <span className="text-muted text-sm capitalize">{row.difficulty}</span>
                {row.status === "approved" ? (
                  <span className="text-sm">{row.publishDate ?? "in pool"}</span>
                ) : (
                  <DecisionBadge decision={row.review?.decision ?? "pending"} />
                )}
                <span className="text-muted text-xs">{row.createdAt.slice(0, 10)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminCasesPage(props: PageProps<"/[locale]/admin">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <CasesContent {...props} />
    </Suspense>
  );
}
