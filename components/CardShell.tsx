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
	cardClassName = "p-6 shadow",
}: Props) {
	return (
		<div className="min-h-screen bg-cream flex items-center justify-center px-6 py-10">
			<div
				className={`w-full ${maxWidthClassName} bg-white rounded-2xl border border-orange/20 ${cardClassName}`}
			>
				{children}
			</div>
		</div>
	);
}


