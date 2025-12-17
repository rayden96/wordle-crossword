export type CrosswordEntry = { answer: string; clue: string };

export type CrosswordData = {
	across: Record<string, { clue: string; answer: string; row: number; col: number }>;
	down: Record<string, { clue: string; answer: string; row: number; col: number }>;
};

type Direction = "across" | "down";

type Cell = {
	letter: string;
	across: boolean;
	down: boolean;
};

type Placement = {
	answer: string;
	clue: string;
	dir: Direction;
	row: number;
	col: number;
};

type Candidate = {
	dir: Direction;
	row: number;
	col: number;
	intersections: number;
	nextArea: number;
};

function normalizeAnswer(raw: string): string {
	return String(raw ?? "")
		.toUpperCase()
		.trim()
		.replace(/[^A-Z]/g, "");
}

function key(row: number, col: number) {
	return `${row},${col}`;
}

function cloneGrid(grid: Map<string, Cell>): Map<string, Cell> {
	const next = new Map<string, Cell>();
	for (const [k, v] of grid.entries()) next.set(k, { ...v });
	return next;
}

function getBounds(grid: Map<string, Cell>) {
	let minRow = 0,
		maxRow = -1,
		minCol = 0,
		maxCol = -1;
	for (const k of grid.keys()) {
		const [rS, cS] = k.split(",");
		const r = Number(rS);
		const c = Number(cS);
		if (maxRow === -1) {
			minRow = maxRow = r;
			minCol = maxCol = c;
		} else {
			minRow = Math.min(minRow, r);
			maxRow = Math.max(maxRow, r);
			minCol = Math.min(minCol, c);
			maxCol = Math.max(maxCol, c);
		}
	}
	return { minRow, maxRow, minCol, maxCol };
}

function areaForBounds(b: { minRow: number; maxRow: number; minCol: number; maxCol: number }) {
	if (b.maxRow < b.minRow || b.maxCol < b.minCol) return 0;
	return (b.maxRow - b.minRow + 1) * (b.maxCol - b.minCol + 1);
}

function isEmpty(grid: Map<string, Cell>, row: number, col: number) {
	return !grid.has(key(row, col));
}

function getCell(grid: Map<string, Cell>, row: number, col: number): Cell | undefined {
	return grid.get(key(row, col));
}

function canPlaceWord(
	grid: Map<string, Cell>,
	placement: Placement
): { ok: boolean; intersections: number } {
	const ans = placement.answer;
	if (!ans) return { ok: false, intersections: 0 };

	const dr = placement.dir === "down" ? 1 : 0;
	const dc = placement.dir === "across" ? 1 : 0;

	// Boundary before/after must be empty.
	const beforeR = placement.row - dr;
	const beforeC = placement.col - dc;
	if (!isEmpty(grid, beforeR, beforeC)) return { ok: false, intersections: 0 };
	const afterR = placement.row + dr * ans.length;
	const afterC = placement.col + dc * ans.length;
	if (!isEmpty(grid, afterR, afterC)) return { ok: false, intersections: 0 };

	let intersections = 0;
	for (let i = 0; i < ans.length; i++) {
		const r = placement.row + dr * i;
		const c = placement.col + dc * i;
		const ch = ans[i];
		const existing = getCell(grid, r, c);

		if (!existing) {
			// Strict adjacency: perpendicular neighbors must be empty for new cells.
			if (placement.dir === "across") {
				if (!isEmpty(grid, r - 1, c) || !isEmpty(grid, r + 1, c)) {
					return { ok: false, intersections: 0 };
				}
			} else {
				if (!isEmpty(grid, r, c - 1) || !isEmpty(grid, r, c + 1)) {
					return { ok: false, intersections: 0 };
				}
			}
		} else {
			// Letter must match
			if (existing.letter !== ch) return { ok: false, intersections: 0 };

			// Must be a true crossing (no parallel overlap).
			if (placement.dir === "across") {
				if (existing.across) return { ok: false, intersections: 0 };
				if (!existing.down) return { ok: false, intersections: 0 };
			} else {
				if (existing.down) return { ok: false, intersections: 0 };
				if (!existing.across) return { ok: false, intersections: 0 };
			}
			intersections++;
		}
	}

	return { ok: true, intersections };
}

function applyPlacement(grid: Map<string, Cell>, placement: Placement) {
	const ans = placement.answer;
	const dr = placement.dir === "down" ? 1 : 0;
	const dc = placement.dir === "across" ? 1 : 0;
	for (let i = 0; i < ans.length; i++) {
		const r = placement.row + dr * i;
		const c = placement.col + dc * i;
		const k = key(r, c);
		const existing = grid.get(k);
		if (!existing) {
			grid.set(k, {
				letter: ans[i],
				across: placement.dir === "across",
				down: placement.dir === "down",
			});
		} else {
			grid.set(k, {
				...existing,
				across: existing.across || placement.dir === "across",
				down: existing.down || placement.dir === "down",
			});
		}
	}
}

function placementKey(p: Placement) {
	return `${p.dir}:${p.row},${p.col}:${p.answer}`;
}

function buildCandidatesForWord(
	grid: Map<string, Cell>,
	word: CrosswordEntry
): Candidate[] {
	const ans = word.answer;
	const gridCells: Array<{ row: number; col: number; cell: Cell }> = [];
	for (const [k, cell] of grid.entries()) {
		const [rS, cS] = k.split(",");
		gridCells.push({ row: Number(rS), col: Number(cS), cell });
	}
	gridCells.sort((a, b) => (a.row - b.row) || (a.col - b.col) || (a.cell.letter.localeCompare(b.cell.letter)));

	const curBounds = getBounds(grid);
	const curArea = areaForBounds(curBounds);

	const seen = new Set<string>();
	const out: Candidate[] = [];

	for (let i = 0; i < ans.length; i++) {
		const ch = ans[i];
		for (const g of gridCells) {
			if (g.cell.letter !== ch) continue;

			// Determine allowed direction based on existing cell usage.
			// If the cell is only across => we can cross with down.
			// If only down => we can cross with across.
			// If both => can't add another word through this cell.
			let dir: Direction | null = null;
			if (g.cell.across && !g.cell.down) dir = "down";
			else if (g.cell.down && !g.cell.across) dir = "across";
			else dir = null;
			if (!dir) continue;

			const row = dir === "down" ? g.row - i : g.row;
			const col = dir === "across" ? g.col - i : g.col;
			const p: Placement = { answer: ans, clue: word.clue, dir, row, col };
			const check = canPlaceWord(grid, p);
			if (!check.ok) continue;

			const tmp = cloneGrid(grid);
			applyPlacement(tmp, p);
			const b = getBounds(tmp);
			const nextArea = Math.max(curArea, areaForBounds(b));

			const k = `${dir}:${row},${col}`;
			if (seen.has(k)) continue;
			seen.add(k);
			out.push({ dir, row, col, intersections: check.intersections, nextArea });
		}
	}

	out.sort((a, b) => {
		// More intersections is better; smaller area is better; then stable tie-breaks.
		return (
			(b.intersections - a.intersections) ||
			(a.nextArea - b.nextArea) ||
			(a.row - b.row) ||
			(a.col - b.col) ||
			(a.dir.localeCompare(b.dir))
		);
	});
	return out;
}

function chooseNextWord(unplaced: CrosswordEntry[], grid: Map<string, Cell>) {
	const lettersInGrid = new Set<string>();
	for (const cell of grid.values()) lettersInGrid.add(cell.letter);

	const scored = unplaced.map((w) => {
		let overlap = 0;
		for (const ch of w.answer) if (lettersInGrid.has(ch)) overlap++;
		return { w, overlap };
	});

	scored.sort((a, b) => {
		return (
			(b.overlap - a.overlap) ||
			(b.w.answer.length - a.w.answer.length) ||
			a.w.answer.localeCompare(b.w.answer)
		);
	});
	return scored[0]?.w;
}

function solveFromSeed(entries: CrosswordEntry[], seed: CrosswordEntry) {
	const placements: Placement[] = [];
	let grid = new Map<string, Cell>();

	// Place seed at origin, across.
	const seedPlacement: Placement = {
		answer: seed.answer,
		clue: seed.clue,
		dir: "across",
		row: 0,
		col: 0,
	};
	applyPlacement(grid, seedPlacement);
	placements.push(seedPlacement);

	const remaining = entries.filter((e) => e.answer !== seed.answer);

	const usedPlacementKeys = new Set<string>();

	function rec(currGrid: Map<string, Cell>, unplaced: CrosswordEntry[], currPlacements: Placement[]): boolean {
		if (unplaced.length === 0) {
			grid = currGrid;
			placements.splice(0, placements.length, ...currPlacements);
			return true;
		}

		const nextWord = chooseNextWord(unplaced, currGrid);
		if (!nextWord) return false;

		const candidates = buildCandidatesForWord(currGrid, nextWord);
		if (candidates.length === 0) return false;

		for (const cand of candidates) {
			const p: Placement = {
				answer: nextWord.answer,
				clue: nextWord.clue,
				dir: cand.dir,
				row: cand.row,
				col: cand.col,
			};
			const pKey = placementKey(p);
			if (usedPlacementKeys.has(pKey)) continue;
			usedPlacementKeys.add(pKey);

			const nextGrid = cloneGrid(currGrid);
			applyPlacement(nextGrid, p);
			const nextUnplaced = unplaced.filter((x) => x.answer !== nextWord.answer);
			const nextPlacements = [...currPlacements, p];
			if (rec(nextGrid, nextUnplaced, nextPlacements)) return true;
		}
		return false;
	}

	const ok = rec(grid, remaining, placements);
	return ok ? { grid, placements } : null;
}

function buildCrosswordDataFromSolution(solution: { grid: Map<string, Cell>; placements: Placement[] }): CrosswordData {
	const { grid, placements } = solution;
	const bounds = getBounds(grid);
	const rowOffset = -bounds.minRow;
	const colOffset = -bounds.minCol;

	const placementByStart = new Map<string, Placement>();
	for (const p of placements) {
		placementByStart.set(`${p.dir}:${p.row},${p.col}`, p);
	}

	const across: CrosswordData["across"] = {};
	const down: CrosswordData["down"] = {};

	let num = 0;
	const numberForStart = new Map<string, number>();

	for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
		for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
			const cell = getCell(grid, r, c);
			if (!cell) continue;

			const left = getCell(grid, r, c - 1);
			const up = getCell(grid, r - 1, c);

			const startsAcross = cell.across && !(left?.across);
			const startsDown = cell.down && !(up?.down);

			if (!startsAcross && !startsDown) continue;

			num++;

			if (startsAcross) {
				const k = `across:${r},${c}`;
				numberForStart.set(k, num);
				const p = placementByStart.get(k);
				if (!p) throw new Error(`Missing across placement at ${r},${c}`);
				across[String(num)] = {
					answer: p.answer,
					clue: p.clue,
					row: r + rowOffset,
					col: c + colOffset,
				};
			}
			if (startsDown) {
				const k = `down:${r},${c}`;
				numberForStart.set(k, num);
				const p = placementByStart.get(k);
				if (!p) throw new Error(`Missing down placement at ${r},${c}`);
				down[String(num)] = {
					answer: p.answer,
					clue: p.clue,
					row: r + rowOffset,
					col: c + colOffset,
				};
			}
		}
	}

	return { across, down };
}

export function generateCrosswordDataStrict(entriesRaw: CrosswordEntry[]): CrosswordData {
	const cleaned: CrosswordEntry[] = entriesRaw
		.map((e) => ({ answer: normalizeAnswer(e.answer), clue: String(e.clue ?? "").trim() }))
		.filter((e) => e.answer.length > 0 && e.clue.length > 0);

	if (cleaned.length === 0) {
		throw new Error("No crossword entries provided");
	}

	// Deduplicate by answer deterministically (first clue wins).
	const byAnswer = new Map<string, CrosswordEntry>();
	for (const e of cleaned) {
		if (!byAnswer.has(e.answer)) byAnswer.set(e.answer, e);
	}
	const entries = [...byAnswer.values()];

	// Deterministic seed order: longest then lexicographic.
	const seeds = [...entries].sort((a, b) => (b.answer.length - a.answer.length) || a.answer.localeCompare(b.answer));

	for (const seed of seeds) {
		const sol = solveFromSeed(entries, seed);
		if (sol) return buildCrosswordDataFromSolution(sol);
	}

	throw new Error("Unable to generate a strict crossword that fits all provided words");
}


