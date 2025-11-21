"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { todayYmd } from "@/utils/date";
import Loading from "@/components/Loading";

export default function Home() {
	const [code, setCode] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string>("");
	const router = useRouter();
	return (
		<div className="min-h-screen flex items-center justify-center bg-cream px-6">
			<div className="w-full max-w-md rounded-2xl shadow-lg bg-white p-8 border border-orange/20">
				<h1 className="text-3xl font-semibold text-rust mb-6">
					Hello Monkey Bean. Ready to solve this puzzle?
				</h1>
				<label className="block text-sm text-rust/80 mb-2">Code</label>
				<input
					className="w-full rounded-md border border-orange/40 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange/60 bg-cream/30 text-rust placeholder:text-rust/40"
					placeholder=""
					value={code}
					onChange={(e) => setCode(e.target.value.toUpperCase())}
				/>
				{error && (
					<div className="mt-2 text-sm text-red-600">{error}</div>
				)}
				<button
					onClick={() => {
						const trimmed = code.trim();
						if (!trimmed) return;
						if (trimmed !== "BEEPBOOP") {
							setError("Incorrect code");
							return;
						}
						setError("");
						setSubmitting(true);
						localStorage.setItem("player_code", "BEEPBOOP");
						fetch("/api/progress", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								code: "BEEPBOOP",
								date: todayYmd(),
								wordleCompleted: false,
								crosswordCompleted: false,
							}),
						})
							.finally(() => router.push("/wordle"))
							.catch(() => setSubmitting(false));
					}}
					className="mt-6 w-full bg-orange text-white py-2.5 rounded-md hover:opacity-95 active:opacity-90"
				>
					Begin
				</button>
				{submitting && (
					<div className="mt-4">
						<Loading />
					</div>
				)}
			</div>
		</div>
	);
}


