"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useRouter } from "@/i18n/navigation";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await createSupabaseBrowserClient().auth.signOut();
        router.replace("/admin/login");
        router.refresh();
      }}
      className="text-muted text-sm hover:underline"
    >
      Sign out
    </button>
  );
}
