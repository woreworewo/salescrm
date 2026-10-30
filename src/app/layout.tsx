import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Salesroom · CRM", template: "%s · Salesroom" },
  description: "Workspace sales untuk client, peluang, dan tindak lanjut.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
