import "./globals.css";
import { BrandHeader } from "@/components/BrandHeader";
import { TabNav } from "@/components/TabNav";

export const metadata = {
  title: "Coveted Hospitality",
  description: "Revenue & operations dashboard",
};

// Apply saved theme before paint to avoid a light/dark flash on load.
const themeInitScript = `
(function(){try{
  var t = localStorage.getItem("coveted-theme");
  document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark");
}catch(e){
  document.documentElement.setAttribute("data-theme", "dark");
}})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <BrandHeader />
        <TabNav />
        {children}
      </body>
    </html>
  );
}
