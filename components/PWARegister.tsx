"use client";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PWARegister() {
	const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		if (process.env.NODE_ENV !== "production") return;
		if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
		const onLoad = () => {
			navigator.serviceWorker.register("/sw.js").catch(() => {});
		};
		if (document.readyState === "complete") onLoad();
		else window.addEventListener("load", onLoad);
		return () => window.removeEventListener("load", onLoad);
	}, []);

	useEffect(() => {
		const onPrompt = (e: Event) => {
			e.preventDefault();
			setInstallEvt(e as BeforeInstallPromptEvent);
		};
		window.addEventListener("beforeinstallprompt", onPrompt);
		return () => window.removeEventListener("beforeinstallprompt", onPrompt);
	}, []);

	if (!installEvt || dismissed) return null;

	return (
		<div className="fixed inset-x-0 bottom-3 z-40 flex justify-center px-4 pointer-events-none">
			<div className="pointer-events-auto rounded-xl border border-orange/30 bg-white/95 backdrop-blur shadow-lg px-4 py-3 text-rust w-[min(26rem,calc(100vw-2rem))] flex items-center gap-3">
				<div className="flex-1 text-sm">Install MonkeyBeanGames for offline access.</div>
				<button
					onClick={async () => {
						await installEvt.prompt();
						setInstallEvt(null);
					}}
					className="px-3 py-1.5 rounded-md bg-orange text-white text-sm"
				>
					Install
				</button>
				<button
					onClick={() => setDismissed(true)}
					className="text-rust/60 text-sm hover:text-rust"
				>
					Later
				</button>
			</div>
		</div>
	);
}
