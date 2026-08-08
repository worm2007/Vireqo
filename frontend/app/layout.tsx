import type { Metadata } from "next";
import "./globals.css";
import "./homepage-v3.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.vireqo.in"),
  title: {
    default: "Vireqo — AI CRM for Smarter Lead Follow-Ups",
    template: "%s | Vireqo",
  },
  description:
    "Vireqo is an AI-powered CRM workspace that helps teams manage leads, tasks, follow-ups, sales pipelines and customer conversations.",
  applicationName: "Vireqo",
  keywords: ["AI CRM", "lead management", "sales automation", "pipeline management", "Vireqo"],
  authors: [{ name: "Vireqo" }],
  creator: "Vireqo",
  publisher: "Vireqo",
  openGraph: {
    title: "Vireqo — AI CRM for Smarter Lead Follow-Ups",
    description:
      "Manage leads, tasks, follow-ups and sales pipelines with an AI-powered CRM workspace.",
    url: "https://www.vireqo.in",
    siteName: "Vireqo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vireqo — AI CRM for Smarter Lead Follow-Ups",
    description:
      "Manage leads, tasks, follow-ups and sales pipelines with an AI-powered CRM workspace.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
