import type { Metadata } from "next";
import { Abril_Fatface, Libre_Caslon_Text, Libre_Franklin } from "next/font/google";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { routing } from "@/i18n/routing";
import "../globals.css";

// latin-ext covers Turkish letters (ğ, ş, ı, İ).
const abril = Abril_Fatface({
  variable: "--font-abril",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});
const caslon = Libre_Caslon_Text({
  variable: "--font-caslon",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin", "latin-ext"],
});
const franklin = Libre_Franklin({ variable: "--font-franklin", subsets: ["latin", "latin-ext"] });

// Cache Components needs at least one value per root param; this prerenders /en and /tr.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html
      lang={locale}
      className={`${abril.variable} ${caslon.variable} ${franklin.variable} antialiased`}
    >
      <body className="min-h-dvh">
        {/* Makes translations available to Client Components (e.g. LocaleSwitcher). */}
        <NextIntlClientProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl px-4 pb-20">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
