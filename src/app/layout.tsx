import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import localFont from "next/font/local";

import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

/**
 * Self-hosted from files in this repo (`src/app/fonts/`), subset to the
 * scripts in use.
 *
 * Served from this origin, which matters for three reasons: the CSP can keep
 * `font-src 'self'`, no request leaves for a third party carrying a hospital's
 * referrer, and a hospital network that blocks Google still renders correctly.
 *
 * The files are committed rather than fetched by `next/font/google` at build
 * time: Google intermittently answers with a `fonts.gstatic.com/l/font?kit=…`
 * address that Turbopack cannot resolve, and the whole app then fails with a
 * 500 — a deploy build included. `scripts/build-fonts.py` rebuilds them from
 * the google/fonts sources (SIL Open Font License; licences in the folder).
 *
 * Instrument Sans for text and DM Mono for numbers (Frost and slate). Instrument
 * Sans has no Devanagari coverage, so Noto Sans Devanagari is stacked in
 * `--font-sans` rather than swapped by locale: a Hindi screen still shows
 * English drug names and UHIDs, and picking a font per page would render
 * those in whatever the browser fell back to. Stacking lets each glyph come
 * from the family that actually has it, in the same line of text.
 */
const instrument = localFont({
  // Variable: one file serves 400–600, the weights the UI uses.
  src: "./fonts/InstrumentSans.woff2",
  weight: "400 600",
  variable: "--font-latin",
  display: "swap",
});

// DM Mono has no rupee sign (U+20B9) upstream — it never did, Google's subset
// only declared the range — so ₹ falls through the mono stack to Noto Sans
// Devanagari, whose file carries it.
const mono = localFont({
  src: [
    { path: "./fonts/DMMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/DMMono-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-dm-mono",
  display: "swap",
});

const devanagari = localFont({
  src: "./fonts/NotoSansDevanagari.woff2",
  weight: "400 600",
  variable: "--font-devanagari",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: { default: t("name"), template: `%s · ${t("shortName")}` },
    description: "Patient journey management",
    // Internal system behind a login. Nothing here should ever be indexed.
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Zoom stays enabled. Pinch-to-zoom is how someone reads a dose on a
  // ward tablet in poor light, and disabling it is an accessibility failure
  // dressed up as polish.
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fa" },
    { media: "(prefers-color-scheme: dark)", color: "#141d22" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${instrument.variable} ${devanagari.variable} ${mono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground flex min-h-full flex-col antialiased">
        {/* Locale and messages are inherited from the server config — see
            `src/i18n/request.ts`. */}
        <NextIntlClientProvider>
          <Providers>
            {children}
            {/* Bottom-centre, and above the fold on a laptop: a confirmation
                in a screen corner is a confirmation nobody at a busy counter
                ever sees. */}
            <Toaster position="bottom-center" richColors closeButton duration={4000} />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
