"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/server/admin/actions";

type Props = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  submitLabel: string;
  pendingLabel?: string;
  /** Asks before submitting, for actions that are hard to undo. */
  confirmText?: string;
  tone?: "primary" | "danger" | "plain";
  children?: ReactNode;
  className?: string;
};

const TONES = {
  primary: "bg-ink text-paper hover:opacity-90",
  danger: "bg-accent text-paper hover:opacity-90",
  plain: "border-rule hover:border-ink border",
} as const;

/** A form bound to a Server Action, showing its pending state and result message. */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel = "Working…",
  confirmText,
  tone = "primary",
  children,
  className = "",
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
      className={`space-y-2 ${className}`}
    >
      {children}
      <button
        type="submit"
        disabled={pending}
        className={`rounded px-4 py-2 text-sm font-semibold disabled:opacity-50 ${TONES[tone]}`}
      >
        {pending ? pendingLabel : submitLabel}
      </button>
      {state && (
        <p
          role="status"
          className={`text-sm ${state.ok ? "text-green-800" : "text-accent"} break-words`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
