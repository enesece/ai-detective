"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** Free-tier models can take ~20 s on busy evenings; tell the player it's coming. */
const SLOW_MS = 4_000;
const VERY_SLOW_MS = 12_000;

/** Placeholder while a suspect's answer hasn't started: "…", then a word on the wait. */
export function WaitingForAnswer({ name }: { name: string }) {
  const t = useTranslations("Interrogation");
  const [stage, setStage] = useState<"start" | "slow" | "verySlow">("start");

  useEffect(() => {
    const slow = setTimeout(() => setStage("slow"), SLOW_MS);
    const verySlow = setTimeout(() => setStage("verySlow"), VERY_SLOW_MS);
    return () => {
      clearTimeout(slow);
      clearTimeout(verySlow);
    };
  }, []);

  if (stage === "start") return <span className="text-muted italic">{t("thinking")}</span>;
  return (
    <span className="text-muted italic">
      {t("thinkingSlow", { name })}
      {stage === "verySlow" && <span className="block text-base">{t("thinkingVerySlow")}</span>}
    </span>
  );
}
