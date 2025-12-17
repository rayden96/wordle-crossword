"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { todayYmd } from "@/utils/date";
import dynamic from "next/dynamic";
import { useRef } from "react";
import type { Experience as ExperienceType } from "@/types/experience";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import CardShell from "@/components/CardShell";

// Prevent SSR for the crossword component to avoid hydration edge-cases.
const CrosswordNoSSR = dynamic(
	() =>
		import("@jaredreisinger/react-crossword").then((m) => m.Crossword),
	{ ssr: false }
);

// Confetti reads window size; prevent SSR to avoid hydration mismatches.
const ConfettiNoSSR = dynamic(() => import("react-confetti"), { ssr: false });

type CrosswordData = ExperienceType["crossword_data"];
type Experience = { crossword_data: CrosswordData };
type CrosswordHandle = { isCrosswordCorrect?: () => boolean; reset?: () => void };
type CellMap = Record<string, string>; // "row,col" -> "A".."Z"

export default function CrosswordPage() {
	const [loading, setLoading] = useState(true);
	const [experience, setExperience] = useState<Experience | null>(null);
	const [code, setCode] = useState<string>("");
	const [status, setStatus] = useState<string>("");
	const [statusDetail, setStatusDetail] = useState<string>("");
	const [showCongrats, setShowCongrats] = useState(false);
	const [noContent, setNoContent] = useState(false);
	const router = useRouter();
	const date = useMemo(() => todayYmd(), []);
	const xwRef = useRef<CrosswordHandle | null>(null);
	const completedRef = useRef(false);
	const [cells, setCells] = useState<CellMap>({});

	const computeWrongClues = useMemo(() => {
		const data = experience?.crossword_data;
		if (!data) return null;

		const getCell = (row: number, col: number) => cells[`${row},${col}`] ?? "";

		const evalEntry = (
			dir: "across" | "down",
			entry: { answer: string; row: number; col: number }
		) => {
			const ans = entry.answer.toUpperCase();
			let incomplete = false;
			let wrong = false;
			for (let i = 0; i < ans.length; i++) {
				const r = entry.row + (dir === "down" ? i : 0);
				const c = entry.col + (dir === "across" ? i : 0);
				const ch = getCell(r, c);
				if (!ch) incomplete = true;
				else if (ch !== ans[i]) wrong = true;
			}
			return { incomplete, wrong };
		};

		const wrongAcross: string[] = [];
		const incompleteAcross: string[] = [];
		for (const [num, entry] of Object.entries(data.across ?? {})) {
			const res = evalEntry("across", entry);
			if (res.incomplete) incompleteAcross.push(num);
			else if (res.wrong) wrongAcross.push(num);
		}

		const wrongDown: string[] = [];
		const incompleteDown: string[] = [];
		for (const [num, entry] of Object.entries(data.down ?? {})) {
			const res = evalEntry("down", entry);
			if (res.incomplete) incompleteDown.push(num);
			else if (res.wrong) wrongDown.push(num);
		}

		const fmt = (label: string, nums: string[]) =>
			nums.length ? `${label} ${nums.sort((a, b) => Number(a) - Number(b)).join(", ")}` : "";

		const parts = [
			fmt("Across incomplete:", incompleteAcross),
			fmt("Across incorrect:", wrongAcross),
			fmt("Down incomplete:", incompleteDown),
			fmt("Down incorrect:", wrongDown),
		].filter(Boolean);

		return {
			ok:
				wrongAcross.length === 0 &&
				wrongDown.length === 0 &&
				incompleteAcross.length === 0 &&
				incompleteDown.length === 0,
			message: parts.join(" • "),
		};
	}, [cells, experience?.crossword_data]);

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
			} else {
				setNoContent(true);
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
		<CardShell maxWidthClassName="max-w-4xl">
				{noContent && <Notice message="Come back soon for your challenge." />}
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
						{status !== "correct" && statusDetail && (
							<div className="mt-1 text-rust/80">{statusDetail}</div>
						)}
					</div>
				)}
				{loading && <Loading />}
				{!loading && experience && (
					<div className="rounded-md border border-orange/30 p-3 bg-cream/40 overflow-x-auto">
						<div className="min-w-[320px] inline-block">
							<CrosswordNoSSR
								ref={(instance) => {
									// Store a limited handle without using 'any'
									xwRef.current = (instance as unknown) as CrosswordHandle;
								}}
								data={experience.crossword_data}
								onCellChange={(row: number, col: number, char: string) => {
									setCells((prev) => ({
										...prev,
										[`${row},${col}`]: (char ?? "").toUpperCase(),
									}));
								}}
								onCrosswordComplete={(isCorrect?: boolean) => {
									// Only advance if both the library reports correctness AND
									// our imperative handle agrees (when available).
									const handleOk = xwRef.current?.isCrosswordCorrect?.();
									const ok =
										(isCorrect === true) && (handleOk !== false);
									if (ok) {
										if (completedRef.current) return;
										completedRef.current = true;
										setStatus("correct");
										setStatusDetail("");
										setShowCongrats(true);
										// Small delay so the user sees the celebration.
										setTimeout(() => void markComplete(), 1000);
									} else {
										setStatus("incorrect");
										setStatusDetail(computeWrongClues?.message ?? "");
									}
								}}
							/>
						</div>
					</div>
				)}
				<div className="mt-4">
					<button
						onClick={() => {
							try {
								const ok = xwRef.current?.isCrosswordCorrect?.();
								const computedOk = computeWrongClues?.ok;
								const finalOk = ok === true || computedOk === true;
								setStatus(finalOk ? "correct" : "incorrect");
								setStatusDetail(finalOk ? "" : (computeWrongClues?.message ?? ""));
							} catch {
								setStatus("");
								setStatusDetail("");
							}
						}}
						className="border border-orange/40 text-rust bg-cream px-4 py-2 rounded-md mr-2"
					>
						Check answers
					</button>
				</div>
				{showCongrats && (
					<>
						<ConfettiNoSSR numberOfPieces={220} recycle={false} />
						<div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
							<div className="rounded-xl border border-orange/30 bg-white/95 backdrop-blur px-4 py-3 shadow-lg text-rust">
								<div className="font-semibold">Well done!</div>
								<div className="text-sm text-rust/70">Taking you to your reward…</div>
							</div>
						</div>
					</>
				)}
		</CardShell>
	);
}


