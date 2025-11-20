"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { todayYmd } from "@/utils/date";
import dynamic from "next/dynamic";
import { useRef } from "react";

// Prevent SSR for the crossword component to avoid hydration edge-cases.
const CrosswordNoSSR = dynamic(
	() =>
		import("@jaredreisinger/react-crossword").then((m) => m.Crossword),
	{ ssr: false }
);

type Experience = {
	crossword_data: any;
};

export default function CrosswordPage() {
	const [loading, setLoading] = useState(true);
	const [experience, setExperience] = useState<Experience | null>(null);
	const [code, setCode] = useState<string>("");
	const [status, setStatus] = useState<string>("");
	const router = useRouter();
	const date = useMemo(() => todayYmd(true), []);
	const xwRef = useRef<any>(null);

	useEffect(() => {
		const c = localStorage.getItem("player_code");
		if (!c) {
			router.replace("/");
			return;
		}
		setCode(c);
		(async () => {
			// Gate: require Wordle completion
			const prog = await fetch(`/api/progress?code=${encodeURIComponent(c)}&date=${date}`);
			if (prog.ok) {
				const p = await prog.json();
				if (!p?.wordle_completed) {
					router.replace("/wordle");
					return;
				}
			}
			const res = await fetch(`/api/experience?date=${date}`);
			if (res.ok) {
				const data = await res.json();
				setExperience({ crossword_data: data.crossword_data });
			}
			setLoading(false);
		})();
	}, [date, router]);

	const markComplete = async () => {
		await fetch("/api/progress", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				code,
				date,
				wordleCompleted: true,
				crosswordCompleted: true,
			}),
		});
		router.push("/reward");
	};

	return (
		<div className="min-h-screen bg-cream flex items-center justify-center px-6">
			<div className="w-full max-w-4xl bg-white rounded-2xl border border-orange/20 p-6 shadow">
				<h2 className="text-2xl font-semibold text-rust mb-2">Crossword</h2>
				<p className="text-orange/80 mb-4">
					Fill in the crossword to unlock your reward.
				</p>
				{status && (
					<div
						className={`mb-3 text-sm ${
							status === "correct" ? "text-rust" : "text-orange"
						}`}
					>
						{status === "correct"
							? "Looks perfect!"
							: "Some answers are still incorrect."}
					</div>
				)}
				{loading && <div className="text-rust/70">Loading...</div>}
				{!loading && experience && (
					<div className="rounded-md border border-orange/30 p-3 bg-cream/40">
						<CrosswordNoSSR
							ref={xwRef as any}
							data={experience.crossword_data}
							onCrosswordComplete={markComplete as any}
						/>
					</div>
				)}
				<div className="mt-4">
					<button
						onClick={() => {
							try {
								const ok = xwRef.current?.isCrosswordCorrect?.();
								setStatus(ok ? "correct" : "incorrect");
							} catch {
								setStatus("");
							}
						}}
						className="border border-orange/40 text-rust bg-cream px-4 py-2 rounded-md mr-2"
					>
						Check answers
					</button>
					<button
						onClick={markComplete}
						className="bg-orange text-white px-4 py-2 rounded-md"
					>
						Mark Completed
					</button>
				</div>
			</div>
		</div>
	);
}


