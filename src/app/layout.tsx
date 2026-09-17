import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Career Intelligence — Your next chapter",
    template: "%s | Career Intelligence",
  },
  description:
    "A thoughtful workspace for your job search. Track applications, understand your progress, and focus on your next opportunity.",
  robots: { index: false, follow: false },
  metadataBase: new URL(process.env.APP_URL || "http://127.0.0.1:3100"),
  openGraph: {
    title: "Career Intelligence",
    description: "A clearer view of your next move.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Career Intelligence — A clearer view of your next move.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Career Intelligence",
    description: "A clearer view of your next move.",
    images: ["/og.png"],
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
