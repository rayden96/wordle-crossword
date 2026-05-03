"use client";

import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
	maxWidthClassName?: string;
	cardClassName?: string;
};

export default function CardShell({
	children,
	maxWidthClassName = "max-w-2xl",
	cardClassName = "p-4 sm:p-7 shadow-md",
}: Props) {
	return (
		<div className="min-h-[100dvh] bg-gradient-to-b from-cream via-cream to-orange/10 flex items-center justify-center px-2 sm:px-4 py-4 sm:py-10">
			<div
				className={`w-full ${maxWidthClassName} bg-white/95 backdrop-blur rounded-2xl border border-orange/20 ${cardClassName}`}
			>
				{children}
			</div>
		</div>
	);
}
