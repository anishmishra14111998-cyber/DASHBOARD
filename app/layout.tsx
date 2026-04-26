import "./globals.css";
import type { Metadata } from "next";
import { BrandHeader } from "@/components/BrandHeader";
import { TabNav } from "@/components/TabNav";

export const metadata: Metadata = {
  title: "Coveted Hospitality · Operations",
  description: "Revenue + cleaning dashboards for Coveted Hospitality",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BrandHeader />
        <TabNav />
        {children}
      </body>
    </html>
  );
}
