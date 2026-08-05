# Migration Guide: Static HTML to Next.js + Convex

This document outlines the step-by-step plan to migrate our current static HTML/JS Convex image-share gallery into a modern **Next.js** application. We will execute this migration later.

---

## Phase 1: Project Initialization
1. Initialize Next.js with TypeScript and Tailwind CSS:
   ```bash
   npx create-next-app@latest . --typescript --tailwind --app --no-src-dir
   ```
2. Install Convex and Cloudinary dependencies:
   ```bash
   npm install convex cloudinary
   ```
3. Initialize Convex in the Next.js project:
   ```bash
   npx convex dev --configure=existing
   ```
   *(Or link to your existing Convex project deployment)*

---

## Phase 2: Directory & File Structure
Organize the Next.js App Router structure:
```text
├── app/
│   ├── layout.tsx          # Root layout with Convex provider
│   ├── page.tsx            # Main gallery dashboard
│   └── globals.css         # Tailwind styles
├── convex/                 # Existing Convex backend functions (schema, images.ts, etc.)
├── public/                 # Static assets
└── NEXTJS_MIGRATION.md     # This migration guide
```

---

## Phase 3: Convex Provider Setup (`app/layout.tsx`)
Wrap the Next.js app with the Convex client provider:
```tsx
"tsx"
import type { Metadata } from "next";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Convex Gallery Next.js",
  description: "Image sharing gallery powered by Convex and Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
```

---

## Phase 4: Core Component Migration (`app/page.tsx`)
Convert `index.html` logic into React components utilizing Convex real-time hooks:
- Use `useQuery(api.images.list)` to fetch images and folders reactively.
- Use Cloudinary unsigned upload widget or API for image uploads.
- Use `useMutation(api.images.remove)` for deleting images.

---

## Phase 5: Environment Variables Setup
Create `.env.local` for local development:
```env
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
```

---

## Phase 6: Testing & Deployment
1. Run the Next.js development server:
   ```bash
   npm run dev
   ```
2. Verify real-time gallery updates, folder navigation, and image deletions.
3. Deploy to Vercel or your preferred hosting provider:
   ```bash
   npx vercel
   ```
   *(Ensure environment variables are configured in the hosting dashboard)*

