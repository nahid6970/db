import type { Metadata } from "next";
import ConvexClientProvider from "./ConvexClientProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "STATS MANAGER",
  description:
    "Real-time schedules, live scores, and countdown timers for Valorant tournaments globally in Bangladesh Standard Time (BST).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;900&family=Rajdhani:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
        <link
          rel="icon"
          type="image/svg+xml"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23ff4655'/><circle cx='50' cy='50' r='15' fill='white'/><rect x='46' y='5' width='8' height='30' fill='white'/><rect x='46' y='65' width='8' height='30' fill='white'/><rect x='5' y='46' width='30' height='8' fill='white'/><rect x='65' y='46' width='30' height='8' fill='white'/></svg>"
        />
      </head>
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
