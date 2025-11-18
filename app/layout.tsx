import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton
} from '@clerk/nextjs';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Image Enhancer - Free Photo Enhancement",
  description: "Enhance your photos with instant filters. Apply brightness, contrast, saturation and more. Free and easy to use.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <header className="border-b bg-background">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <Link href="/" className="text-xl font-semibold hover:text-primary transition-colors">
                Image Enhancer
              </Link>
              <div className="flex items-center gap-4">
                <Link 
                  href="/info" 
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  Info
                </Link>
                <SignedIn>
                  <Link 
                    href="/subscriptions" 
                    className="text-sm font-medium hover:text-primary transition-colors"
                  >
                    Subscriptions
                  </Link>
                </SignedIn>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="text-sm font-medium hover:text-primary transition-colors">
                      Sign In
                    </button>
                  </SignInButton>
                  <SignInButton mode="modal">
                    <button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors">
                      Sign Up
                    </button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </div>
            </div>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
