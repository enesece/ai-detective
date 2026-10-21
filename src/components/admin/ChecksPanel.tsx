import type { Review } from "@/server/admin/data";

const MARK = { ok: "✓", error: "✗", warning: "!" } as const;

/** The pipeline's verdict: logic checks and what the blind solver concluded. */
export function ChecksPanel({
  review,
  suspectName,
}: {
  review: Review;
  suspectName: (id: string) => string;
}) {
  const checks = review.checks;
  return (
    <div className="space-y-4 text-sm">
      <p>
        <DecisionBadge decision={review.decision} />{" "}
        <span className="text-muted">{new Date(review.createdAt).toUTCString()}</span>
      </p>
      {review.adminNotes && <p className="text-accent break-words">{review.adminNotes}</p>}
      {!checks ? (
        <p className="text-muted">No automatic checks stored for this review.</p>
      ) : (
        <>
          <p className="text-muted">
            {[
              checks.theme && `Theme: ${checks.theme}`,
              checks.generatorModel && `Writer: ${checks.generatorModel}`,
              checks.solverModel && `Solver: ${checks.solverModel}`,
              checks.durationMs !== undefined && `${Math.round(checks.durationMs / 1000)} s`,
              checks.recheck && "recheck",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {checks.tooEasy && (
            <p className="text-accent font-semibold">
              Too easy: solved from the case file alone, without interrogation.
            </p>
          )}
          <ul className="space-y-1">
            {checks.logic.map((c) => (
              <li
                key={c.id}
                className={c.ok ? "" : c.severity === "error" ? "text-accent" : "text-amber-800"}
              >
                <span className="mr-1 font-mono">{c.ok ? MARK.ok : MARK[c.severity]}</span>
                <span className="font-semibold">{c.id}</span> — {c.message}
              </li>
            ))}
          </ul>
          {checks.solver.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Blind solver</h3>
              {checks.solver.map((run, i) => (
                <div key={i} className="border-rule rounded border p-3">
                  <p className="font-semibold">
                    {run.mode === "full" ? "With interrogations" : "Case file only"}:{" "}
                    {suspectName(run.answer.killerId)} — real killer{" "}
                    {Math.round(run.killerProbability * 100)}%
                    {run.runnerUp &&
                      `, runner-up ${suspectName(run.runnerUp.suspectId)} ${Math.round(run.runnerUp.probability * 100)}%`}{" "}
                    {run.passed ? "✓" : "✗"}
                  </p>
                  <p className="text-muted">
                    Motive {run.correctMotive ? "✓" : "✗"} · Key evidence{" "}
                    {run.correctKeyEvidence ? "✓" : "✗"}
                  </p>
                  <p className="mt-1">{run.answer.reasoning}</p>
                </div>
              ))}
            </div>
          )}
          {checks.attempts && checks.attempts.length > 1 && (
            <details>
              <summary className="cursor-pointer font-semibold">Repair history</summary>
              <ol className="mt-2 list-decimal space-y-2 pl-5">
                {checks.attempts.map((a, i) => (
                  <li key={i}>
                    {a.kind} ({Math.round(a.ms / 1000)} s):{" "}
                    {a.problems.length === 0 ? "no problems" : a.problems.join(" | ")}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
      )}
    </div>
  );
}

export function DecisionBadge({ decision }: { decision: Review["decision"] }) {
  const styles = {
    pending: "bg-amber-100 text-amber-900",
    rejected: "bg-red-100 text-red-900",
    approved: "bg-green-100 text-green-900",
  } as const;
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${styles[decision]}`}>
      {decision}
    </span>
  );
}
