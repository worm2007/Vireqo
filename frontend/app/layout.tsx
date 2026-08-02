import type { Metadata } from "next";
import "./globals.css";
import "./homepage-v3.css";

export const metadata: Metadata = {
  title: "Vireqo — AI Lead Operating System",
  description: "Capture, qualify and convert high-intent enquiries with an AI lead operating system.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
