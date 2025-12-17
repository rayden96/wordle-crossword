"use client";
import { useEffect, useMemo, useState } from "react";

type Props = { message: string };
export default function Notice({ message }: Props) {
	const [open, setOpen] = useState(true);
	const id = useMemo(() => `notice-${Math.random().toString(16).slice(2)}`, []);

	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center"
			role="dialog"
			aria-modal="true"
			aria-labelledby={id}
		>
			<button
				type="button"
				className="absolute inset-0 bg-black/30"
				aria-label="Close notice"
				onClick={() => setOpen(false)}
			/>
			<div className="relative bg-white border border-orange/30 rounded-xl p-6 shadow-xl max-w-sm mx-auto text-center w-[min(24rem,calc(100vw-2rem))]">
				<button
					type="button"
					className="absolute right-3 top-3 rounded-md border border-orange/30 bg-cream px-2 py-1 text-sm text-rust hover:opacity-90"
					aria-label="Close"
					onClick={() => setOpen(false)}
				>
					Close
				</button>
				<p id={id} className="text-rust text-lg pr-12">
					{message}
				</p>
			</div>
		</div>
	);
}


