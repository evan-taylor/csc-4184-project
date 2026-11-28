import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Evening Planner",
  description: "Plan events and make time for evening activities.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en" suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
