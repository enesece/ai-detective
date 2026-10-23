import type { GenerationRun } from "@/server/admin/github";

/** Plain words for GitHub's run status + conclusion. */
function describe(run: GenerationRun): { label: string; className: string } {
  if (run.status !== "completed") {
    return { label: run.status === "queued" ? "Queued" : "Running", className: "text-ink" };
  }
  if (run.conclusion === "success") return { label: "Done", className: "text-green-800" };
  if (run.conclusion === "cancelled") return { label: "Cancelled", className: "text-muted" };
  return { label: "Failed", className: "text-alert" };
}

function minutesBetween(from: string, to: string): number {
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60_000));
}

type Props = { runs: GenerationRun[] };

/** The latest generation runs on GitHub Actions, each linking to its log. */
export function GenerationRuns({ runs }: Props) {
  if (runs.length === 0) return <p className="text-muted text-sm">No runs yet.</p>;

  return (
    <ul className="divide-rule border-rule divide-y rounded border text-sm">
      {runs.map((run) => {
        const { label, className } = describe(run);
        const done = run.status === "completed";
        return (
          <li key={run.id}>
            <a
              href={run.html_url}
              target="_blank"
              rel="noreferrer"
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 hover:bg-white"
            >
              <span className={`w-20 font-semibold ${className}`}>{label}</span>
              <span className="min-w-0 flex-1">{run.display_title}</span>
              <span className="text-muted text-xs">
                {run.created_at.slice(0, 16).replace("T", " ")} UTC
                {done && ` · ${minutesBetween(run.created_at, run.updated_at)} min`}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
