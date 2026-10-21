"use client";

import { buttonInk, buttonPrimary } from "@/components/ui/styles";
import { gameFetch } from "@/lib/supabase/session";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { CaseOptions } from "@/lib/case/options";
import type { AccuseRequest, GameError } from "@/lib/game/rules";
import { toGameError } from "./errors";
import { useGameSnapshot } from "./useGameSnapshot";

type Props = { caseNumber: number; options: CaseOptions };
type Choice = { killerId: string | null; motiveId: string | null; evidenceId: string | null };

export function AccusationForm({ caseNumber, options }: Props) {
  const t = useTranslations("Accusation");
  const tErrors = useTranslations("Interrogation.errors");
  const router = useRouter();
  const game = useGameSnapshot(caseNumber);
  const [choice, setChoice] = useState<Choice>({
    killerId: null,
    motiveId: null,
    evidenceId: null,
  });
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<GameError | null>(null);
  const resultHref = `/case/${caseNumber}/result`;

  // Already accused: there is only one try, so go straight to the result.
  const alreadyFinished = game.status === "ready" && game.snapshot?.result != null;
  useEffect(() => {
    if (alreadyFinished) router.replace(resultHref);
  }, [alreadyFinished, router, resultHref]);

  const { killerId, motiveId, evidenceId } = choice;
  const complete = killerId !== null && motiveId !== null && evidenceId !== null;

  async function submit() {
    if (!complete) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: AccuseRequest = { caseNumber, killerId, motiveId, evidenceId };
      const res = await gameFetch("/api/accuse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.push(resultHref);
        return;
      }
      const code = toGameError(await res.json().catch(() => null));
      if (code === "game_over") {
        router.replace(resultHref);
        return;
      }
      setError(code);
    } catch {
      setError("ai_unavailable");
    }
    setSubmitting(false);
    setConfirming(false);
  }

  return (
    <div className="space-y-8">
      {game.status === "ready" && game.snapshot && (
        <p className="text-muted text-sm">
          {t("progress", {
            questions: game.snapshot.questionsUsed,
            limit: game.snapshot.questionLimit,
            hints: game.snapshot.hintsUsed,
          })}
        </p>
      )}

      <ChoiceGroup legend={t("killer")}>
        {options.suspects.map((s) => (
          <ChoiceCard
            key={s.id}
            name="killer"
            checked={killerId === s.id}
            onSelect={() => setChoice({ ...choice, killerId: s.id })}
            title={s.name}
            subtitle={s.role}
          />
        ))}
      </ChoiceGroup>

      <ChoiceGroup legend={t("motive")}>
        {options.motives.map((m) => (
          <ChoiceCard
            key={m.id}
            name="motive"
            checked={motiveId === m.id}
            onSelect={() => setChoice({ ...choice, motiveId: m.id })}
            title={m.label}
          />
        ))}
      </ChoiceGroup>

      <ChoiceGroup legend={t("evidence")}>
        {options.evidence.map((e) => (
          <ChoiceCard
            key={e.id}
            name="evidence"
            checked={evidenceId === e.id}
            onSelect={() => setChoice({ ...choice, evidenceId: e.id })}
            title={e.title}
          />
        ))}
      </ChoiceGroup>

      <div className="border-ink border-t-4 border-double pt-6">
        {error && (
          <p role="alert" className="text-alert mb-3 text-sm font-semibold">
            {tErrors(error)}
          </p>
        )}
        {confirming ? (
          <div className="border-ink bg-card space-y-4 border-t-[3px] p-5">
            <p className="text-lg font-bold">{t("confirm")}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={submit}
                className={buttonPrimary}
              >
                {t("confirmYes")}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirming(false)}
                className="text-muted min-h-12 px-3 font-sans text-sm font-bold tracking-[0.15em] uppercase"
              >
                {t("confirmNo")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={!complete || alreadyFinished}
            onClick={() => setConfirming(true)}
            className={buttonInk}
          >
            {complete ? t("submit") : t("chooseAll")}
          </button>
        )}
      </div>
    </div>
  );
}

function ChoiceGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="font-display border-ink mb-4 w-full border-b pb-2 text-3xl">
        {legend}
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

type ChoiceCardProps = {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
};

function ChoiceCard({ name, checked, onSelect, title, subtitle }: ChoiceCardProps) {
  return (
    <label
      className={`has-[:focus-visible]:outline-accent cursor-pointer border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
        checked ? "border-ink bg-ink text-paper" : "border-rule bg-card hover:border-ink"
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      <span className="block font-bold">{title}</span>
      {subtitle && (
        <span className={`block text-sm italic ${checked ? "opacity-80" : "text-muted"}`}>
          {subtitle}
        </span>
      )}
    </label>
  );
}
