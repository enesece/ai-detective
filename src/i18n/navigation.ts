import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware wrappers: <Link href="/case/1"> becomes /en/case/1 or /tr/case/1.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
