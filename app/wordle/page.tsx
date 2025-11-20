"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { todayYmd } from "@/utils/date";
import Wordle from "@/components/Wordle";

type Experience = {
	wordle_answer: string;
};

export default function WordlePage() {
	const [loading, setLoading] = useState(true);
	const [experience, setExperience] = useState<Experience | null>(null);
	const [code, setCode] = useState<string>("");
	const router = useRouter();

	useEffect(() => {
		const c = localStorage.getItem("player_code");
		if (!c) {
			router.replace("/");
			return;
		}
		setCode(c);
		(async () => {
			setLoading(true);
			// If already completed, skip ahead
			const pg = await fetch(
				`/api/progress?code=${encodeURIComponent(c)}&date=${todayYmd(true)}`
			);
			if (pg.ok) {
				const p = await pg.json();
				if (p?.wordle_completed) {
					router.replace("/crossword");
					return;
				}
			}
			const res = await fetch(`/api/experience?date=${todayYmd(true)}`);
			if (res.ok) {
				const data = await res.json();
				setExperience({ wordle_answer: data.wordle_answer });
			}
			setLoading(false);
		})();
	}, [router]);

	const markComplete = async () => {
		await fetch("/api/progress", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				code,
				date: todayYmd(true),
				wordleCompleted: true,
				crosswordCompleted: false,
			}),
		});
		// Small delay so the confetti is visible
		setTimeout(() => router.push("/crossword"), 1000);
	};

	return (
		<div className="min-h-screen bg-cream flex items-center justify-center px-6">
			<div className="w-full max-w-2xl bg-white rounded-2xl border border-orange/20 p-6 shadow">
				<h2 className="text-2xl font-semibold text-rust mb-2">Wordle</h2>
				<p className="text-orange/80 mb-4">
					Guess today&apos;s special word. Good luck!
				</p>
				{loading && <div className="text-rust/70">Loading...</div>}
				{!loading && experience && (
					<div className="text-sm text-rust/70 mb-4">
						<Wordle solution={experience.wordle_answer} onSolved={markComplete} />
					</div>
				)}
				<div className="mt-2 flex items-center">
					<button
						onClick={async () => {
							if (!code) return;
							await fetch("/api/progress", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									code,
									date: todayYmd(true),
									wordleCompleted: false,
									crosswordCompleted: false,
								}),
							});
							// reload page state
							router.refresh();
						}}
						className="ml-2 border border-orange/40 text-rust bg-cream px-4 py-2 rounded-md"
						title="Reset today across devices"
					>
						Reset today (server)
					</button>
				</div>
			</div>
		</div>
	);
}


