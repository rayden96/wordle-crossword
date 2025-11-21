"use client";
type Props = { message: string };
export default function Notice({ message }: Props) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="absolute inset-0 bg-black/30" />
			<div className="relative bg-white border border-orange/30 rounded-xl p-6 shadow-xl max-w-sm mx-auto text-center">
				<p className="text-rust text-lg">{message}</p>
			</div>
		</div>
	);
}


