"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

// Confetti reads window size; prevent SSR to avoid hydration mismatches.
const ConfettiNoSSR = dynamic(() => import("react-confetti"), { ssr: false });

type Props = {
	solution: string;
	onSolved?: () => void;
	maxGuesses?: number;
};

type TileState = "correct" | "present" | "absent";

function evaluateGuess(guess: string, solution: string): TileState[] {
	const res: TileState[] = Array(guess.length).fill("absent");
	const solChars = solution.split("");
	const used = Array(solChars.length).fill(false);
	// correct pass
	for (let i = 0; i < guess.length; i++) {
		if (guess[i] === solChars[i]) {
			res[i] = "correct";
			used[i] = true;
		}
	}
	// present pass
	for (let i = 0; i < guess.length; i++) {
		if (res[i] !== "correct") {
			for (let j = 0; j < solChars.length; j++) {
				if (!used[j] && guess[i] === solChars[j]) {
					res[i] = "present";
					used[j] = true;
					break;
				}
			}
		}
	}
	return res;
}

export default function Wordle({ solution, onSolved, maxGuesses = 6 }: Props) {
	const normalizedSolution = useMemo(
		() => solution.toUpperCase().trim(),
		[solution]
	);
	const size = normalizedSolution.length;
	const [guesses, setGuesses] = useState<string[]>([]);
	const [current, setCurrent] = useState<string>("");
	const [solved, setSolved] = useState<boolean>(false);
	const [error, setError] = useState<string>("");

	const canType = !solved && guesses.length < maxGuesses;

	const resetBoard = useCallback(() => {
		setGuesses([]);
		setCurrent("");
		setSolved(false);
		setError("");
	}, []);

	const submitGuess = useCallback(async () => {
		if (!canType) return;
		if (current.length !== size) return;
		const guess = current.toUpperCase();
		// Validate word via API (real dictionary)
		try {
			const res = await fetch(`/api/validate-word?word=${guess.toLowerCase()}`);
			const { valid } = await res.json();
			if (!valid) {
				setError("Not a valid word");
				return;
			}
		} catch {
			// If API fails, proceed without blocking
		}
		setError("");
		const next = [...guesses, guess];
		setGuesses(next);
		setCurrent("");
		if (guess === normalizedSolution) {
			setSolved(true);
		}
	}, [canType, current, size, guesses, normalizedSolution]);

	useEffect(() => {
		if (solved && onSolved) onSolved();
	}, [solved, onSolved]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!canType) return;
			if (e.key === "Enter") {
				submitGuess();
				return;
			}
			if (e.key === "Backspace") {
				setCurrent((c) => c.slice(0, -1));
				return;
			}
			const k = e.key.toUpperCase();
			if (/^[A-Z]$/.test(k)) {
				setCurrent((c) =>
					c.length < size ? (c + k).slice(0, size) : c
				);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [canType, size, submitGuess]);

	return (
		<div>
			<div className="mb-3 text-rust/70 text-sm">
				Type letters, Enter to submit, Backspace to delete.
				<span className="ml-2">
					Attempts: {guesses.length}/{maxGuesses}
				</span>
			</div>
			<div className="grid gap-2">
				{Array.from({ length: maxGuesses }).map((_, row) => {
					const guess = guesses[row] ?? (row === guesses.length ? current : "");
					const filled = (guesses[row] ?? "").length === size;
					const evalStates =
						row < guesses.length
							? evaluateGuess(guesses[row], normalizedSolution)
							: Array(size).fill("absent");
					return (
						<div
							key={row}
							className="grid grid-cols-5 gap-2"
							style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
						>
							{Array.from({ length: size }).map((__, col) => {
								const ch = guess[col] ?? "";
								const state =
									row < guesses.length
										? (evalStates[col] as TileState)
										: "absent";
								const bg =
									row < guesses.length
										? state === "correct"
											? "bg-rust text-white"
											: state === "present"
											? "bg-orange text-white"
											: "bg-cream text-rust border-orange/30"
										: "bg-cream text-rust border-orange/30";
								const border = "border";
								return (
									<div
										key={col}
										className={`h-12 flex items-center justify-center rounded-md ${border} ${bg} font-semibold tracking-widest`}
									>
										{ch}
									</div>
								);
							})}
						</div>
					);
				})}
			</div>
			{error && (
				<div className="mt-2 text-sm text-red-600">{error}</div>
			)}
			<div className="mt-4 flex gap-2">
				<button
					onClick={() => setCurrent((c) => c.slice(0, -1))}
					className="px-3 py-2 rounded-md border border-orange/40 text-rust bg-cream hover:opacity-90"
					disabled={!canType || current.length === 0}
				>
					Backspace
				</button>
				<button
					onClick={submitGuess}
					className="px-4 py-2 rounded-md bg-orange text-white hover:opacity-95"
					disabled={!canType || current.length !== size}
				>
					Enter
				</button>
				<button
					onClick={resetBoard}
					className="px-3 py-2 rounded-md border border-orange/40 text-rust bg-cream hover:opacity-90 ml-auto"
				>
					Reset attempts
				</button>
			</div>
			<div className="mt-3 flex items-center gap-4 text-sm">
				<div className="flex items-center gap-2">
					<div className="w-5 h-5 rounded-md bg-rust" />
					<span className="text-rust/80">Correct</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-5 h-5 rounded-md bg-orange" />
					<span className="text-rust/80">Right letter, wrong spot</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-5 h-5 rounded-md border border-orange/30 bg-cream" />
					<span className="text-rust/80">Not in word</span>
				</div>
			</div>
			{solved && <ConfettiNoSSR numberOfPieces={200} recycle={false} />}
		</div>
	);
}


