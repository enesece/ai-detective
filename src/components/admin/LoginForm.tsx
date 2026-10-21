"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getTurnstileToken } from "@/lib/turnstile";
import { useRouter } from "@/i18n/navigation";

/** Email + password sign-in for the admin. Supabase sets the session cookie. */
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      // With CAPTCHA on in Supabase, password sign-in needs a Turnstile token too.
      const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      const captchaToken = siteKey ? await getTurnstileToken(siteKey) : undefined;
      const { error: signInError } = await createSupabaseBrowserClient().auth.signInWithPassword({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        options: { captchaToken },
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-rule bg-card max-w-sm space-y-4 rounded-lg border p-6"
    >
      <label className="block text-sm font-semibold">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="border-rule mt-1 block w-full rounded border bg-white px-3 py-2 font-normal"
        />
      </label>
      <label className="block text-sm font-semibold">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="border-rule mt-1 block w-full rounded border bg-white px-3 py-2 font-normal"
        />
      </label>
      {error && (
        <p role="alert" className="text-accent text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-ink text-paper w-full rounded px-4 py-2 font-semibold disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
