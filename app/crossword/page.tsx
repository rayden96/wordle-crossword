"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { todayYmd } from "@/utils/date";
import type { Experience as ExperienceType } from "@/types/experience";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import CardShell from "@/components/CardShell";
import Crossword, { type CrosswordHandle } from "@/components/Crossword";
import { useSession } from "@/components/SessionProvider";

const ConfettiNoSSR = dynamic(() => import("react-confetti"), { ssr: false });

type Data = ExperienceType["crossword_data"];

export default function CrosswordPage() {
	const [loading, setLoading] = useState(true);
	const [data, setData] = useState<Data | null>(null);
	const [status, setStatus] = useState<"" | "correct" | "incorrect">("");
	const [statusDetail, setStatusDetail] = useState("");
	const [showCongrats, setShowCongrats] = useState(false);
	const [noContent, setNoContent] = useState(false);
	const [hintMsg, setHintMsg] = useState("");
	const router = useRouter();
	const date = useMemo(() => todayYmd(), []);
	const xwRef = useRef<CrosswordHandle | null>(null);
	const completedRef = useRef(false);
	const session = useSession();

	useEffect(() => {
		if (!session.ready) return;
		if (!session.userId) {
			router.replace("/");
			return;
		}
		(async () => {
			const prog = await fetch(`/api/progress?code=${encodeURIComponent(session.userId!)}&date=${date}`);
			if (prog.ok) {
				const p = await prog.json();
				if (!p?.wordle_completed) {
					router.replace("/wordle");
					return;
				}
			}
			const res = await fetch(`/api/experience?date=${date}`);
			if (res.ok) {
				const d = await res.json();
				setData(d.crossword_data);
			} else {
				setNoContent(true);
			}
			setLoading(false);
		})();
	}, [date, router, session.ready, session.userId]);

	const markComplete = async () => {
		if (completedRef.current) return;
		completedRef.current = true;
		setShowCongrats(true);
		await fetch("/api/progress", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				code: session.userId,
				date,
				wordleCompleted: true,
				crosswordCompleted: true,
			}),
		});
		setTimeout(() => router.push("/reward"), 1200);
	};

	const onCheck = () => {
		const r = xwRef.current?.checkAll();
		if (!r) return;
		if (r.ok) {
			setStatus("correct");
			setStatusDetail("");
		} else {
			setStatus("incorrect");
			const parts: string[] = [];
			if (r.incomplete) parts.push("Some squares are still blank.");
			if (r.wrongAcross.length) parts.push(`Across: ${r.wrongAcross.join(", ")}`);
			if (r.wrongDown.length) parts.push(`Down: ${r.wrongDown.join(", ")}`);
			setStatusDetail(parts.join(" • "));
		}
	};

	const onHint = () => {
		const got = xwRef.current?.revealRandomLetter();
		if (!got) {
			setHintMsg("No empty squares left.");
		} else {
			setHintMsg(`Filled one letter in ${got.dir === "across" ? "Across" : "Down"} ${got.num}.`);
		}
	};

	return (
		<CardShell maxWidthClassName="max-w-5xl">
			{noContent && <Notice message="Come back soon for your challenge." />}
			<h2 className="text-2xl font-semibold text-rust mb-1">Crossword</h2>
			<p className="text-orange/80 mb-4">Fill in the crossword to unlock your reward.</p>

			<div className="mb-3 flex flex-wrap items-center gap-2">
				<button
					onClick={onCheck}
					disabled={loading || !data}
					className="border border-orange/40 text-rust bg-cream px-4 py-2 rounded-md disabled:opacity-50"
				>
					Check answers
				</button>
				<button
					onClick={onHint}
					disabled={loading || !data || showCongrats}
					className="border border-orange/40 text-rust bg-cream px-4 py-2 rounded-md disabled:opacity-50"
				>
					Reveal letter
				</button>
				{status && (
					<div
						className={`text-sm ${status === "correct" ? "text-rust" : "text-orange"}`}
					>
						{status === "correct"
							? "Looks perfect!"
							: statusDetail || "Some answers are still incorrect."}
					</div>
				)}
				{hintMsg && <div className="text-sm text-rust/70 ml-auto">{hintMsg}</div>}
			</div>

			{loading && <Loading />}
			{!loading && data && (
				<Crossword ref={xwRef} data={data} onSolved={markComplete} />
			)}

			{showCongrats && (
				<>
					<ConfettiNoSSR numberOfPieces={220} recycle={false} />
					<div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
						<div className="rounded-xl border border-orange/30 bg-white/95 backdrop-blur px-4 py-3 shadow-lg text-rust w-[min(26rem,calc(100vw-2rem))]">
							<div className="font-semibold">Well done!</div>
							<div className="mt-1 flex items-center gap-2 text-sm text-rust/70">
								<Loading />
								<span>Taking you to your reward…</span>
							</div>
						</div>
					</div>
				</>
			)}
		</CardShell>
	);
}
