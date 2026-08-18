import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GlobalErrorHandler from '@/components/GlobalErrorHandler';
import GlobalAlertModal from '@/components/GlobalAlertModal';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "AI Trading Journal",
  description: "AI-powered Trading Performance & Analytics",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <GlobalErrorHandler />
        <GlobalAlertModal />
        {children}
      </body>
    </html>
  );
}
