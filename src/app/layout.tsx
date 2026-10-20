import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Puntito · La cuenta, clara",
  description:
    "Los puntos de tu grupo, en un solo lugar. Creá una partida, compartí el enlace y a jugar.",
  appleWebApp: { capable: true, title: "Puntito", statusBarStyle: "default" },
  icons: {
    icon: "/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f7f2",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
