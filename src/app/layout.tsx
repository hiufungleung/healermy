import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "@/components/providers/ClientProviders";
import { Toaster } from "sonner";
import { cookies } from "next/headers";
import { decrypt } from "@/library/auth/encryption";
import { TOKEN_COOKIE_NAME } from "@/library/auth/config";
import type { SessionData } from "@/types/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "healerMy - Healthcare Appointment Management",
    template: "%s | healerMy"
  },
  description: "FHIR-based healthcare appointment management system for patients and providers",
  icons: {
    icon: "/favicon.svg", // Small icon for browser tabs (100x100)
    apple: "/icon.svg",    // Large icon for Apple devices and PWA (512x512)
  },
  other: {
    'msapplication-TileColor': '#3B82F6',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get session from cookie (if exists) - works for both public and protected pages
  let session: SessionData | null = null;
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(TOKEN_COOKIE_NAME);
    if (tokenCookie) {
      const decryptedSessionString = await decrypt(tokenCookie.value);
      session = JSON.parse(decryptedSessionString);
    }
  } catch (error) {
    // Silent fail - session will be null for unauthenticated users
    console.debug('No session found in root layout');
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ClientProviders initialSession={session}>
          {children}
          <Toaster />
        </ClientProviders>
      </body>
    </html>
  );
}
