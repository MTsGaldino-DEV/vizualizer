import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Syne } from "next/font/google";
import { cssVars } from "@vizualizer/tokens";
import { RegistrarSW } from "@/components/RegistrarSW";
import "./globals.css";
import { cn } from "@/lib/utils";

const syne = Syne({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--fonte-syne" });
const dm = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--fonte-dm" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--fonte-mono" });

export const metadata: Metadata = {
  title: "Vizualizer",
  description: "A sentinela que nunca pisca. Vigiar Â· Avisar Â· Agir.",
  appleWebApp: { capable: true, title: "Vizualizer", statusBarStyle: "black-translucent" },
  icons: { icon: "/marca/vizu-mascote-72.svg", apple: "/icone-180.png" },
};

export const viewport: Viewport = { themeColor: "#0B0B0C", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" style={cssVars as React.CSSProperties} className={cn("dark", syne.variable, dm.variable, mono.variable, "font-sans")}>
      <body className="min-h-dvh bg-tinta text-texto">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
