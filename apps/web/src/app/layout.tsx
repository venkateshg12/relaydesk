import type { Metadata } from "next";
import { Archivo, Geist_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import StoreProvider from "./StoreProvider";
import QueryProvider from "./QueryProvider";
import { ThemeProvider } from "./ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

// One UI family (Instrument Sans); Geist Mono only where the content is code — docs/DESIGN_SYSTEM.md §5.
// Archivo is the display face (§13); its width axis is loaded so headlines can use the expanded cut.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://relaydesk.vercel.app"),
  title: "RelayDesk",
  description: "Live chat for small businesses",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <StoreProvider>
            <QueryProvider>{children}</QueryProvider>
            <Toaster />
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
