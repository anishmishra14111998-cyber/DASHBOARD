"use client";
import { usePathname } from "next/navigation";
import { BrandHeader } from "./BrandHeader";
import { TabNav } from "./TabNav";

// Dashboard chrome (brand banner + tab nav). Hidden on the employee
// time-clock so staff see a clean, standalone check-in screen.
export function Chrome() {
  const pathname = usePathname();
  if (pathname?.startsWith("/timeclock")) return null;
  return (
    <>
      <BrandHeader />
      <TabNav />
    </>
  );
}
