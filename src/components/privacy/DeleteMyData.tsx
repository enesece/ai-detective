"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonOutline } from "@/components/ui/styles";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type State = "checking" | "none" | "idle" | "confirming" | "deleting" | "deleted" | "failed";

/** Deletes the visitor's anonymous account and everything saved with it. */
export function DeleteMyData() {
  const t = useTranslations("Privacy");
  const [state, setState] = useState<State>("checking");

  // Only offer the button to someone who actually has a session on this browser.
  useEffect(() => {
    createSupabaseBrowserClient()
      .auth.getSession()
      .then(({ data }) => setState(data.session ? "idle" : "none"))
      .catch(() => setState("none"));
  }, []);

  async function remove() {
    setState("deleting");
    const res = await fetch("/api/player", { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setState("failed");
      return;
    }
    await createSupabaseBrowserClient().auth.signOut({ scope: "local" });
    // The notebook's local copies.
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith("dd:"))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // Storage blocked: nothing saved there either.
    }
    setState("deleted");
  }

  if (state === "checking") return <div className="h-12" aria-hidden />;
  if (state === "none") return <p className="text-muted italic">{t("noData")}</p>;
  if (state === "deleted")
    return (
      <p role="status" className="font-bold">
        {t("deleted")}
      </p>
    );

  return (
    <div className="space-y-3">
      {state === "failed" && (
        <p role="alert" className="text-alert text-sm font-semibold">
          {t("deleteFailed")}
        </p>
      )}
      {state === "confirming" || state === "deleting" ? (
        <div className="border-alert bg-card space-y-3 border-t-[3px] p-4">
          <p className="font-bold">{t("deleteConfirm")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={state === "deleting"}
              onClick={remove}
              className="bg-alert text-paper min-h-12 px-5 font-sans text-sm font-bold tracking-[0.15em] uppercase disabled:opacity-60"
            >
              {t("deleteYes")}
            </button>
            <button
              type="button"
              disabled={state === "deleting"}
              onClick={() => setState("idle")}
              className="text-muted min-h-12 px-3 font-sans text-sm font-bold tracking-[0.15em] uppercase"
            >
              {t("deleteCancel")}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setState("confirming")} className={buttonOutline}>
          {t("deleteButton")}
        </button>
      )}
    </div>
  );
}
