import "./globals.css";
import { Chrome } from "@/components/Chrome";

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
        <Chrome />
        {children}
      </body>
    </html>
  );
}
