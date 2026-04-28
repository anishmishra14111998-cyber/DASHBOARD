import "./globals.css";
import { BrandHeader } from "@/components/BrandHeader";
import { TabNav } from "@/components/TabNav";

export const metadata = {
  title: "Coveted Hospitality",
  description: "Revenue & operations dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
