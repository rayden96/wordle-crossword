"use client";

import {
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
	forwardRef,
} from "react";
import type { Experience } from "@/types/experience";

type Data = Experience["crossword_data"];
type Direction = "across" | "down";

export type CrosswordHandle = {
	revealRandomLetter: () => { dir: Direction; num: string } | null;
	checkAll: () => { ok: boolean; wrongAcross: string[]; wrongDown: string[]; incomplete: boolean };
	reset: () => void;
};

type Props = {
	data: Data;
	onSolved?: () => void;
};

type CellMeta = {
	row: number;
	col: number;
	answer: string; // expected letter
	across?: { num: string; index: number; len: number };
	down?: { num: string; index: number; len: number };
	number?: string; // start-cell number label
};

function ck(r: number, c: number) {
	return `${r},${c}`;
}

function buildGrid(data: Data) {
	const cells = new Map<string, CellMeta>();
	const ensure = (r: number, c: number, letter: string): CellMeta => {
		const k = ck(r, c);
		const ex = cells.get(k);
		if (ex) return ex;
		const m: CellMeta = { row: r, col: c, answer: letter };
		cells.set(k, m);
		return m;
	};

	for (const [num, e] of Object.entries(data.across ?? {})) {
		const ans = e.answer.toUpperCase();
		for (let i = 0; i < ans.length; i++) {
			const m = ensure(e.row, e.col + i, ans[i]);
			m.across = { num, index: i, len: ans.length };
			if (i === 0) m.number = m.number ? m.number : num;
		}
	}
	for (const [num, e] of Object.entries(data.down ?? {})) {
		const ans = e.answer.toUpperCase();
		for (let i = 0; i < ans.length; i++) {
			const m = ensure(e.row + i, e.col, ans[i]);
			m.down = { num, index: i, len: ans.length };
			if (i === 0) {
				// If both across and down start here, the across number wins by puzzle convention
				// (they share the same number anyway in our generator, but be safe).
				m.number = m.number ?? num;
			}
		}
	}

	let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
	for (const m of cells.values()) {
		if (m.row < minR) minR = m.row;
		if (m.row > maxR) maxR = m.row;
		if (m.col < minC) minC = m.col;
		if (m.col > maxC) maxC = m.col;
	}
	if (!isFinite(minR)) {
		minR = 0; maxR = 0; minC = 0; maxC = 0;
	}

	return {
		cells,
		bounds: { minR, maxR, minC, maxC },
		rows: maxR - minR + 1,
		cols: maxC - minC + 1,
	};
}

const Crossword = forwardRef<CrosswordHandle, Props>(function Crossword({ data, onSolved }, ref) {
	const grid = useMemo(() => buildGrid(data), [data]);
	const [filled, setFilled] = useState<Record<string, string>>({});
	const [cursor, setCursor] = useState<{ row: number; col: number } | null>(null);
	const [direction, setDirection] = useState<Direction>("across");
	const [solved, setSolved] = useState(false);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const onSolvedRef = useRef(onSolved);
	useEffect(() => { onSolvedRef.current = onSolved; }, [onSolved]);

	// Pick an initial cursor on the first valid cell.
	useEffect(() => {
		if (cursor) return;
		// Prefer the first across entry's start.
		const acrossNums = Object.keys(data.across ?? {}).sort((a, b) => Number(a) - Number(b));
		if (acrossNums.length > 0) {
			const e = data.across[acrossNums[0]];
			setCursor({ row: e.row, col: e.col });
			setDirection("across");
			return;
		}
		const downNums = Object.keys(data.down ?? {}).sort((a, b) => Number(a) - Number(b));
		if (downNums.length > 0) {
			const e = data.down[downNums[0]];
			setCursor({ row: e.row, col: e.col });
			setDirection("down");
		}
	}, [data, cursor]);

	const focusInput = useCallback(() => {
		try {
			inputRef.current?.focus({ preventScroll: true });
		} catch {
			inputRef.current?.focus();
		}
	}, []);

	const isCellAt = useCallback(
		(r: number, c: number) => grid.cells.has(ck(r, c)),
		[grid]
	);

	const moveCursor = useCallback((forward: boolean) => {
		setCursor((cur) => {
			if (!cur) return cur;
			const dr = direction === "down" ? (forward ? 1 : -1) : 0;
			const dc = direction === "across" ? (forward ? 1 : -1) : 0;
			const next = { row: cur.row + dr, col: cur.col + dc };
			if (!isCellAt(next.row, next.col)) return cur;
			return next;
		});
	}, [direction, isCellAt]);

	const setLetter = useCallback((letter: string) => {
		setCursor((cur) => {
			if (!cur) return cur;
			const k = ck(cur.row, cur.col);
			if (!grid.cells.has(k)) return cur;
			const L = letter.toUpperCase();
			if (!/^[A-Z]$/.test(L)) return cur;
			setFilled((prev) => ({ ...prev, [k]: L }));
			// Advance forward; if at end of word, stay put.
			const dr = direction === "down" ? 1 : 0;
			const dc = direction === "across" ? 1 : 0;
			const next = { row: cur.row + dr, col: cur.col + dc };
			return isCellAt(next.row, next.col) ? next : cur;
		});
	}, [direction, grid, isCellAt]);

	const backspace = useCallback(() => {
		setCursor((cur) => {
			if (!cur) return cur;
			const k = ck(cur.row, cur.col);
			setFilled((prev) => {
				if (prev[k]) {
					const { [k]: _gone, ...rest } = prev;
					void _gone;
					return rest;
				}
				// Cell already empty: step back and clear that one.
				const dr = direction === "down" ? -1 : 0;
				const dc = direction === "across" ? -1 : 0;
				const back = { row: cur.row + dr, col: cur.col + dc };
				const bk = ck(back.row, back.col);
				if (!grid.cells.has(bk)) return prev;
				const { [bk]: _g2, ...rest2 } = prev;
				void _g2;
				return rest2;
			});
			// Move cursor backward if current was empty
			const k2 = ck(cur.row, cur.col);
			if (!filled[k2]) {
				const dr = direction === "down" ? -1 : 0;
				const dc = direction === "across" ? -1 : 0;
				const back = { row: cur.row + dr, col: cur.col + dc };
				if (isCellAt(back.row, back.col)) return back;
			}
			return cur;
		});
	}, [direction, filled, grid, isCellAt]);

	const onCellClick = useCallback((r: number, c: number) => {
		const meta = grid.cells.get(ck(r, c));
		if (!meta) return;
		setCursor((cur) => {
			if (cur && cur.row === r && cur.col === c) {
				// Toggle direction if both are available
				if (meta.across && meta.down) {
					setDirection((d) => (d === "across" ? "down" : "across"));
				}
				return cur;
			}
			// Choose the direction that this cell supports — prefer current direction if available.
			setDirection((d) => {
				if (d === "across" && meta.across) return "across";
				if (d === "down" && meta.down) return "down";
				if (meta.across) return "across";
				return "down";
			});
			return { row: r, col: c };
		});
		focusInput();
	}, [grid, focusInput]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!cursor) return;
			if (document.activeElement === inputRef.current) return; // mobile path handles it
			if (e.key === "Backspace") { e.preventDefault(); backspace(); return; }
			if (e.key === "ArrowLeft") { setDirection("across"); moveCursor(false); return; }
			if (e.key === "ArrowRight") { setDirection("across"); moveCursor(true); return; }
			if (e.key === "ArrowUp") { setDirection("down"); moveCursor(false); return; }
			if (e.key === "ArrowDown") { setDirection("down"); moveCursor(true); return; }
			if (e.key === " " || e.key === "Tab") {
				e.preventDefault();
				setDirection((d) => (d === "across" ? "down" : "across"));
				return;
			}
			const k = e.key;
			if (/^[a-zA-Z]$/.test(k)) {
				e.preventDefault();
				setLetter(k);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [cursor, backspace, moveCursor, setLetter]);

	// Completion check (deterministic — no library callbacks).
	useEffect(() => {
		if (solved) return;
		let allFilled = true;
		let allCorrect = true;
		for (const [k, meta] of grid.cells) {
			const got = filled[k];
			if (!got) { allFilled = false; break; }
			if (got !== meta.answer) { allCorrect = false; break; }
		}
		if (allFilled && allCorrect) {
			setSolved(true);
			onSolvedRef.current?.();
		}
	}, [filled, grid, solved]);

	// Highlighted entry (for visual hint).
	const activeKeys = useMemo(() => {
		if (!cursor) return new Set<string>();
		const meta = grid.cells.get(ck(cursor.row, cursor.col));
		if (!meta) return new Set<string>();
		const set = new Set<string>();
		if (direction === "across" && meta.across) {
			const e = data.across[meta.across.num];
			for (let i = 0; i < e.answer.length; i++) set.add(ck(e.row, e.col + i));
		} else if (direction === "down" && meta.down) {
			const e = data.down[meta.down.num];
			for (let i = 0; i < e.answer.length; i++) set.add(ck(e.row + i, e.col));
		} else if (meta.across) {
			const e = data.across[meta.across.num];
			for (let i = 0; i < e.answer.length; i++) set.add(ck(e.row, e.col + i));
		} else if (meta.down) {
			const e = data.down[meta.down.num];
			for (let i = 0; i < e.answer.length; i++) set.add(ck(e.row + i, e.col));
		}
		return set;
	}, [cursor, direction, data, grid]);

	const activeClueText = useMemo(() => {
		if (!cursor) return "";
		const meta = grid.cells.get(ck(cursor.row, cursor.col));
		if (!meta) return "";
		if (direction === "across" && meta.across) {
			const e = data.across[meta.across.num];
			return `${meta.across.num} Across — ${e.clue}`;
		}
		if (direction === "down" && meta.down) {
			const e = data.down[meta.down.num];
			return `${meta.down.num} Down — ${e.clue}`;
		}
		return "";
	}, [cursor, direction, data, grid]);

	useImperativeHandle(ref, () => ({
		revealRandomLetter: () => {
			const empties: Array<{ k: string; meta: CellMeta }> = [];
			for (const [k, meta] of grid.cells) {
				if (!filled[k]) empties.push({ k, meta });
			}
			if (empties.length === 0) return null;
			const pick = empties[Math.floor(Math.random() * empties.length)];
			setFilled((prev) => ({ ...prev, [pick.k]: pick.meta.answer }));
			const m = pick.meta;
			if (m.across) return { dir: "across", num: m.across.num };
			if (m.down) return { dir: "down", num: m.down.num };
			return null;
		},
		checkAll: () => {
			const wrongAcross = new Set<string>();
			const wrongDown = new Set<string>();
			let incomplete = false;
			for (const [k, meta] of grid.cells) {
				const got = filled[k];
				if (!got) { incomplete = true; continue; }
				if (got !== meta.answer) {
					if (meta.across) wrongAcross.add(meta.across.num);
					if (meta.down) wrongDown.add(meta.down.num);
				}
			}
			return {
				ok: !incomplete && wrongAcross.size === 0 && wrongDown.size === 0,
				wrongAcross: [...wrongAcross].sort((a, b) => Number(a) - Number(b)),
				wrongDown: [...wrongDown].sort((a, b) => Number(a) - Number(b)),
				incomplete,
			};
		},
		reset: () => {
			setFilled({});
			setSolved(false);
		},
	}), [grid, filled]);

	// Build clue lists for sidebar.
	const acrossList = useMemo(
		() => Object.entries(data.across ?? {}).sort(([a], [b]) => Number(a) - Number(b)),
		[data]
	);
	const downList = useMemo(
		() => Object.entries(data.down ?? {}).sort(([a], [b]) => Number(a) - Number(b)),
		[data]
	);

	const activeAcrossNum = cursor && grid.cells.get(ck(cursor.row, cursor.col))?.across?.num;
	const activeDownNum = cursor && grid.cells.get(ck(cursor.row, cursor.col))?.down?.num;

	const onClueClick = (num: string, dir: Direction) => {
		const e = dir === "across" ? data.across[num] : data.down[num];
		if (!e) return;
		setDirection(dir);
		setCursor({ row: e.row, col: e.col });
		focusInput();
	};

	const cellSize = "min(11vw, 44px)";

	return (
		<div className="flex flex-col gap-4 lg:flex-row lg:items-start">
			{/* Hidden input for mobile keyboards */}
			<input
				ref={inputRef}
				inputMode="text"
				autoCapitalize="characters"
				autoCorrect="off"
				spellCheck={false}
				aria-label="Crossword input"
				className="sr-only"
				onKeyDown={(e) => {
					if (e.key === "Backspace") { e.preventDefault(); backspace(); }
					else if (e.key === "Enter" || e.key === "Tab") {
						e.preventDefault();
						setDirection((d) => (d === "across" ? "down" : "across"));
					}
					else if (e.key === "ArrowLeft") { setDirection("across"); moveCursor(false); }
					else if (e.key === "ArrowRight") { setDirection("across"); moveCursor(true); }
					else if (e.key === "ArrowUp") { setDirection("down"); moveCursor(false); }
					else if (e.key === "ArrowDown") { setDirection("down"); moveCursor(true); }
				}}
				onChange={(e) => {
					const v = e.currentTarget.value.toUpperCase().replace(/[^A-Z]/g, "");
					e.currentTarget.value = "";
					for (const ch of v) setLetter(ch);
				}}
			/>

			<div className="flex-1 min-w-0">
				{/* Active clue banner */}
				<div className="mb-2 rounded-md border border-orange/30 bg-cream/60 px-3 py-2 text-sm text-rust min-h-[2.25rem]">
					{activeClueText || <span className="text-rust/50">Tap a square to begin.</span>}
				</div>

				<div className="overflow-x-auto">
					<div
						className="inline-grid gap-px bg-rust/30 p-px rounded-md select-none"
						style={{
							gridTemplateColumns: `repeat(${grid.cols}, ${cellSize})`,
							gridTemplateRows: `repeat(${grid.rows}, ${cellSize})`,
						}}
					>
						{Array.from({ length: grid.rows }).map((_, rIdx) => (
							Array.from({ length: grid.cols }).map((__, cIdx) => {
								const r = grid.bounds.minR + rIdx;
								const c = grid.bounds.minC + cIdx;
								const meta = grid.cells.get(ck(r, c));
								if (!meta) {
									return <div key={`${r},${c}`} className="bg-transparent" />;
								}
								const filledCh = filled[ck(r, c)] ?? "";
								const isCursor = cursor && cursor.row === r && cursor.col === c;
								const isActive = activeKeys.has(ck(r, c));
								const wrong = filledCh && filledCh !== meta.answer;
								const bg = isCursor
									? "bg-orange/30"
									: isActive
										? "bg-orange/15"
										: "bg-white";
								const text = wrong ? "text-red-600" : "text-rust";
								return (
									<button
										type="button"
										key={`${r},${c}`}
										onClick={() => onCellClick(r, c)}
										className={`relative ${bg} ${text} font-semibold flex items-center justify-center text-lg sm:text-xl active:opacity-80`}
										style={{ width: cellSize, height: cellSize }}
									>
										{meta.number && (
											<span className="absolute top-0 left-0.5 text-[8px] sm:text-[10px] text-rust/70 font-medium leading-none pt-0.5">
												{meta.number}
											</span>
										)}
										<span>{filledCh}</span>
									</button>
								);
							})
						))}
					</div>
				</div>
			</div>

			<div className="lg:w-72 lg:flex-shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 text-sm">
				<div>
					<div className="font-semibold text-rust mb-1">Across</div>
					<ol className="space-y-1">
						{acrossList.map(([num, e]) => (
							<li key={`a-${num}`}>
								<button
									type="button"
									onClick={() => onClueClick(num, "across")}
									className={`text-left w-full rounded px-2 py-1 ${
										activeAcrossNum === num && direction === "across"
											? "bg-orange/20 text-rust"
											: "hover:bg-cream text-rust/80"
									}`}
								>
									<span className="font-semibold mr-2">{num}.</span>
									{e.clue}
								</button>
							</li>
						))}
					</ol>
				</div>
				<div>
					<div className="font-semibold text-rust mb-1">Down</div>
					<ol className="space-y-1">
						{downList.map(([num, e]) => (
							<li key={`d-${num}`}>
								<button
									type="button"
									onClick={() => onClueClick(num, "down")}
									className={`text-left w-full rounded px-2 py-1 ${
										activeDownNum === num && direction === "down"
											? "bg-orange/20 text-rust"
											: "hover:bg-cream text-rust/80"
									}`}
								>
									<span className="font-semibold mr-2">{num}.</span>
									{e.clue}
								</button>
							</li>
						))}
					</ol>
				</div>
			</div>
		</div>
	);
});

export default Crossword;
