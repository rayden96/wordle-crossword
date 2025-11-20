"use client";
export default function Loading() {
	return (
		<div className="w-full flex items-center justify-center">
			<div
				className="h-8 w-8 rounded-full border-2 border-orange border-t-transparent animate-spin"
				aria-label="Loading"
			/>
		</div>
	);
}


