import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import PWARegister from "@/components/PWARegister";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "MonkeyBeanGames",
	description: "Daily Wordle + Crossword, made with love.",
	manifest: "/manifest.webmanifest",
	appleWebApp: {
		capable: true,
		title: "MonkeyBeanGames",
		statusBarStyle: "default",
	},
	icons: {
		icon: "/icon.svg",
		apple: "/icon.svg",
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	themeColor: "#FF7A00",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				suppressHydrationWarning
				className={`${geistSans.variable} ${geistMono.variable} antialiased bg-cream text-rust`}
			>
				<SessionProvider>{children}</SessionProvider>
				<PWARegister />
			</body>
		</html>
	);
}
