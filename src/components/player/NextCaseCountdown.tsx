"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

const MINUTE = 60_000;

// Ticks once a minute; the snapshot is the current minute, so React re-renders only when it changes.
function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 10_000);
  return () => clearInterval(timer);
}
const currentMinute = () => Math.floor(Date.now() / MINUTE);
// No clock on the server: render nothing there, so hydration never mismatches.
const noMinute = () => null;

/** "Next case in about 5 h 12 min". New cases go live just after midnight UTC. */
export function NextCaseCountdown({ className = "" }: { className?: string }) {
  const t = useTranslations("Player");
  const minute = useSyncExternalStore(subscribe, currentMinute, noMinute);
  if (minute === null) return null;

  const now = new Date(minute * MINUTE);
  const nextMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const minutesLeft = Math.max(1, Math.ceil((nextMidnight - now.getTime()) / MINUTE));

  return (
    <p className={className}>
      {t("nextCase", { hours: Math.floor(minutesLeft / 60), minutes: minutesLeft % 60 })}
    </p>
  );
}
