import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "@/styles/globals.css";
import Providers from "./providers";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "SketchTrude — Sketch, trace, and design",
  description:
    "Architectural sketching PWA with layers, scale, measurements, and 3D massing.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SketchTrude",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#a02835",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
