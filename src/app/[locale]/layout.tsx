import type { Metadata } from "next";
import { Lora, Playfair_Display } from "next/font/google";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { routing } from "@/i18n/routing";
import "../globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "latin-ext"],
});

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
    <html lang={locale} className={`${playfair.variable} ${lora.variable} antialiased`}>
      <body className="min-h-dvh">
        {/* Makes translations available to Client Components (e.g. LocaleSwitcher). */}
        <NextIntlClientProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl px-4 pb-16">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
