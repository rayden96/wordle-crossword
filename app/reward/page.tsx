"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { todayYmd } from "@/utils/date";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import RewardBackground from "@/components/RewardBackground";

type Experience = {
	reward_text: string;
};

export default function RewardPage() {
	const [loading, setLoading] = useState(true);
	const [experience, setExperience] = useState<Experience | null>(null);
	const router = useRouter();
	const date = useMemo(() => todayYmd(), []);
	const [noContent, setNoContent] = useState(false);

	useEffect(() => {
		const c = localStorage.getItem("player_code");
		if (!c) {
			router.replace("/");
			return;
		}
		(async () => {
			// Gate: require Crossword completion
			const prog = await fetch(`/api/progress?code=${encodeURIComponent(c)}&date=${date}`);
			if (prog.ok) {
				const p = await prog.json();
				if (!p?.crossword_completed) {
					router.replace("/crossword");
					return;
				}
			}
			const res = await fetch(`/api/experience?date=${date}`);
			if (res.ok) {
				const data = await res.json();
				setExperience({ reward_text: data.reward_text });
			} else {
				setNoContent(true);
			}
			setLoading(false);
		})();
	}, [date, router]);

	return (
		<div className="min-h-screen bg-cream flex items-center justify-center px-6 py-10 relative overflow-hidden">
			<RewardBackground />
			<div className="w-full max-w-2xl rounded-2xl shadow-lg bg-white/95 backdrop-blur border border-orange/20 p-8 relative z-10">
				{noContent && <Notice message="Come back soon for your challenge." />}
				<h2 className="text-2xl font-semibold text-rust mb-2">Your Reward</h2>
				{loading && <Loading />}
				{!loading && experience && (
					<p className="text-lg leading-relaxed text-rust/90 whitespace-pre-wrap">
						{experience.reward_text}
					</p>
				)}
			</div>
		</div>
	);
}


