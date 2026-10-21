"use client";

import { Link, usePathname } from "@/i18n/navigation";

/** The small masthead in the top bar. The home page prints the big one, so it hides there. */
export function HeaderWordmark({ brand }: { brand: string }) {
  const pathname = usePathname();
  if (pathname === "/") return <span aria-hidden />;
  return <Wordmark brand={brand} />;
}

export function Wordmark({ brand }: { brand: string }) {
  return (
    <Link href="/" className="font-display text-lg leading-none whitespace-nowrap sm:text-2xl">
      {brand}
    </Link>
  );
}
