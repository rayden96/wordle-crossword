"use client";

const beans = [
	{ left: "6%", top: "18%", size: 46, dur: 9, delay: 0.2 },
	{ left: "18%", top: "70%", size: 34, dur: 11, delay: 1.1 },
	{ left: "32%", top: "35%", size: 60, dur: 12, delay: 0.6 },
	{ left: "55%", top: "12%", size: 40, dur: 10, delay: 1.7 },
	{ left: "68%", top: "62%", size: 54, dur: 13, delay: 0.9 },
	{ left: "82%", top: "28%", size: 36, dur: 9.5, delay: 2.2 },
	{ left: "90%", top: "76%", size: 44, dur: 12.5, delay: 1.4 },
	{ left: "12%", top: "40%", size: 28, dur: 8.5, delay: 2.6 },
	{ left: "25%", top: "10%", size: 38, dur: 10.8, delay: 0.8 },
	{ left: "40%", top: "78%", size: 50, dur: 14.2, delay: 1.9 },
	{ left: "47%", top: "22%", size: 30, dur: 9.8, delay: 3.1 },
	{ left: "60%", top: "44%", size: 42, dur: 11.6, delay: 0.4 },
	{ left: "74%", top: "8%", size: 32, dur: 10.2, delay: 2.9 },
	{ left: "78%", top: "86%", size: 58, dur: 15.0, delay: 0.5 },
	{ left: "95%", top: "48%", size: 26, dur: 8.9, delay: 1.3 },
];

const sparkles = [
	{ left: "10%", bottom: "-10%", size: 10, dur: 6.5, delay: 0.3 },
	{ left: "22%", bottom: "-15%", size: 7, dur: 7.2, delay: 1.1 },
	{ left: "28%", bottom: "-20%", size: 8, dur: 5.9, delay: 2.0 },
	{ left: "41%", bottom: "-12%", size: 6, dur: 6.8, delay: 0.7 },
	{ left: "52%", bottom: "-18%", size: 9, dur: 7.6, delay: 1.8 },
	{ left: "63%", bottom: "-16%", size: 7, dur: 6.1, delay: 2.6 },
	{ left: "71%", bottom: "-22%", size: 6, dur: 7.0, delay: 0.9 },
	{ left: "84%", bottom: "-14%", size: 8, dur: 6.3, delay: 1.6 },
	{ left: "92%", bottom: "-24%", size: 7, dur: 7.9, delay: 2.4 },
];

export default function RewardBackground() {
	return (
		<div className="absolute inset-0 pointer-events-none overflow-hidden">
			{/* Soft vignette */}
			<div className="absolute inset-0 bg-gradient-to-b from-cream via-cream to-white opacity-90" />

			{/* Floating beans */}
			{beans.map((b, idx) => (
				<div
					key={`bean-${idx}`}
					className="wb-bean wb-animate absolute rounded-[999px] blur-[0.2px]"
					style={{
						left: b.left,
						top: b.top,
						width: b.size,
						height: Math.round(b.size * 0.72),
						animationDuration: `${b.dur}s`,
						animationDelay: `${b.delay}s`,
					}}
				/>
			))}

			{/* Sparkles drifting up */}
			{sparkles.map((s, idx) => (
				<div
					key={`sparkle-${idx}`}
					className="wb-sparkle wb-animate absolute rounded-full"
					style={{
						left: s.left,
						bottom: s.bottom,
						width: s.size,
						height: s.size,
						animationDuration: `${s.dur}s`,
						animationDelay: `${s.delay}s`,
					}}
				/>
			))}
		</div>
	);
}


