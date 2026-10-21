import "server-only";

import { redirect } from "@/i18n/navigation";
import { getAppLocale } from "@/i18n/locale";
import { getAdmin, type Admin } from "@/server/admin/auth";

/** Every admin page calls this first; non-admins go to the login page. */
export async function adminOrRedirect(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) {
    // next-intl's redirect() throws (like Next's), so nothing after it runs.
    redirect({ href: "/admin/login", locale: await getAppLocale() });
    throw new Error("unreachable");
  }
  return admin;
}
