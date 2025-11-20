"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { todayYmd } from "@/utils/date";

export default function Home() {
	const [code, setCode] = useState("");
	const router = useRouter();
	useEffect(() => {
		const saved = localStorage.getItem("player_code");
		if (saved) setCode(saved);
	}, []);
	return (
		<div className="min-h-screen flex items-center justify-center bg-cream px-6">
			<div className="w-full max-w-md rounded-2xl shadow-lg bg-white p-8 border border-orange/20">
				<h1 className="text-3xl font-semibold text-rust mb-2">
					Hi love, ready to play?
				</h1>
				<p className="text-orange/80 mb-6">
					Enter your code to continue where you left off.
				</p>
				<label className="block text-sm text-rust/80 mb-2">Your code</label>
				<input
					className="w-full rounded-md border border-orange/40 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange/60 bg-cream/30 text-rust placeholder:text-rust/40"
					placeholder="e.g. HEART2025"
					value={code}
					onChange={(e) => setCode(e.target.value.toUpperCase())}
				/>
				<button
					onClick={() => {
						const trimmed = code.trim();
						if (!trimmed) return;
						localStorage.setItem("player_code", trimmed);
						// Ensure a progress row exists for today
						fetch("/api/progress", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								code: trimmed,
								date: todayYmd(true),
								wordleCompleted: false,
								crosswordCompleted: false,
							}),
						}).finally(() => router.push("/wordle"));
					}}
					className="mt-6 w-full bg-orange text-white py-2.5 rounded-md hover:opacity-95 active:opacity-90"
				>
					Begin
				</button>
			</div>
		</div>
	);
}


