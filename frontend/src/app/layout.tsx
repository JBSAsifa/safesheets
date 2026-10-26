import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafeSheets | SDS Management",
  description:
    "Manage chemical inventory, Safety Data Sheets, and review dates in one workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
