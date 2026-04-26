import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Revenue Dashboard",
  description: "Live revenue & expenses across Guesty, Booking.com, and Airbnb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
