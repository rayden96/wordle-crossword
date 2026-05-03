"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { todayYmd } from "@/utils/date";
import Wordle from "@/components/Wordle";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import CardShell from "@/components/CardShell";
import { useSession } from "@/components/SessionProvider";

type Experience = {
	wordle_answer: string;
};

export default function WordlePage() {
	const [loading, setLoading] = useState(true);
	const [experience, setExperience] = useState<Experience | null>(null);
	const [noContent, setNoContent] = useState(false);
	const router = useRouter();
	const session = useSession();

	useEffect(() => {
		if (!session.ready) return;
		if (!session.userId) {
			router.replace("/");
			return;
		}
		(async () => {
			setLoading(true);
			const pg = await fetch(
				`/api/progress?code=${encodeURIComponent(session.userId!)}&date=${todayYmd()}`
			);
			if (pg.ok) {
				const p = await pg.json();
				if (p?.wordle_completed) {
					router.replace("/crossword");
					return;
				}
			}
			const res = await fetch(`/api/experience?date=${todayYmd()}`);
			if (res.ok) {
				const data = await res.json();
				setExperience({ wordle_answer: data.wordle_answer });
			} else {
				setNoContent(true);
			}
			setLoading(false);
		})();
	}, [router, session.ready, session.userId]);

	const markComplete = async () => {
		await fetch("/api/progress", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				code: session.userId,
				date: todayYmd(),
				wordleCompleted: true,
				crosswordCompleted: false,
			}),
		});
		setTimeout(() => router.push("/crossword"), 1000);
	};

	return (
		<CardShell maxWidthClassName="max-w-2xl">
			{noContent && <Notice message="Come back soon for your challenge." />}
			<h2 className="text-2xl font-semibold text-rust mb-2">Wordle</h2>
			<p className="text-orange/80 mb-4">Guess today&apos;s special word. Good luck!</p>
			{loading && <Loading />}
			{!loading && experience && (
				<Wordle solution={experience.wordle_answer} onSolved={markComplete} />
			)}
		</CardShell>
	);
}
