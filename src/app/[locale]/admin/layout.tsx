import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";

// The admin panel is for Enes only: English only, never indexed.
export const metadata: Metadata = { title: "Admin · Daily Alibi", robots: { index: false } };

export default function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  return (
    <div className="pt-8">
      <nav className="mb-6 flex flex-wrap items-center gap-4 text-sm font-semibold">
        <span className="font-display text-lg">Admin</span>
        <Link href="/admin" className="hover:underline">
          Cases
        </Link>
        <Link href="/admin/schedule" className="hover:underline">
          Schedule
        </Link>
      </nav>
      {children}
    </div>
  );
}
