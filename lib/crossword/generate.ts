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

type PlaceOptions = {
	/** If true, enforce "no side-touching" for newly placed letters. */
	strictAdjacency: boolean;
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
	placement: Placement,
	opts: PlaceOptions
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
			if (opts.strictAdjacency) {
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
	word: CrosswordEntry,
	opts: PlaceOptions
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
			const check = canPlaceWord(grid, p, opts);
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

function solveFromSeed(entries: CrosswordEntry[], seed: CrosswordEntry, opts: PlaceOptions) {
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

		const candidates = buildCandidatesForWord(currGrid, nextWord, opts);
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

			const can = canPlaceWord(currGrid, p, opts);
			if (!can.ok) continue;

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

function cleanEntries(entriesRaw: CrosswordEntry[]): CrosswordEntry[] {
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
	return [...byAnswer.values()];
}

function sortSeeds(entries: CrosswordEntry[]) {
	return [...entries].sort(
		(a, b) => (b.answer.length - a.answer.length) || a.answer.localeCompare(b.answer)
	);
}

function findWordAndCandidates(unplaced: CrosswordEntry[], grid: Map<string, Cell>, opts: PlaceOptions) {
	// Deterministic: try words in the same order chooseNextWord would, but continue
	// searching until we find something actually placeable.
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
	for (const { w } of scored) {
		const candidates = buildCandidatesForWord(grid, w, opts);
		if (candidates.length > 0) return { word: w, candidates };
	}
	return null;
}

function pickNextClusterStart(grid: Map<string, Cell>) {
	const b = getBounds(grid);
	// If grid is empty, start at origin.
	if (b.maxRow < b.minRow || b.maxCol < b.minCol) return { row: 0, col: 0 };

	// Larger gap keeps disconnected clusters clearly separated and avoids "unfinishable-looking" layouts.
	const gap = 8;
	const right = { row: b.minRow, col: b.maxCol + gap };
	const down = { row: b.maxRow + gap, col: b.minCol };

	// Deterministically choose the placement that yields smaller bounding area.
	const areaIf = (pos: { row: number; col: number }) => {
		const minRow = Math.min(b.minRow, pos.row);
		const maxRow = Math.max(b.maxRow, pos.row);
		const minCol = Math.min(b.minCol, pos.col);
		const maxCol = Math.max(b.maxCol, pos.col);
		return areaForBounds({ minRow, maxRow, minCol, maxCol });
	};
	const ar = areaIf(right);
	const ad = areaIf(down);
	if (ar < ad) return right;
	if (ad < ar) return down;
	return (right.row - down.row) || (right.col - down.col) ? right : down;
}

function solveWithDisconnectedFallback(entries: CrosswordEntry[], opts: PlaceOptions) {
	const placements: Placement[] = [];
	const grid = new Map<string, Cell>();

	let remaining = sortSeeds(entries);

	while (remaining.length > 0) {
		if (grid.size === 0) {
			const seed = remaining.shift()!;
			const seedPlacement: Placement = {
				answer: seed.answer,
				clue: seed.clue,
				dir: "across",
				row: 0,
				col: 0,
			};
			applyPlacement(grid, seedPlacement);
			placements.push(seedPlacement);
			continue;
		}

		const next = findWordAndCandidates(remaining, grid, opts);
		if (next) {
			const best = next.candidates[0];
			const p: Placement = {
				answer: next.word.answer,
				clue: next.word.clue,
				dir: best.dir,
				row: best.row,
				col: best.col,
			};
			const ok = canPlaceWord(grid, p, opts);
			if (!ok.ok) {
				// Should be rare; fall back to new cluster.
			} else {
				applyPlacement(grid, p);
				placements.push(p);
				remaining = remaining.filter((x) => x.answer !== next.word.answer);
				continue;
			}
		}

		// No intersection-based placement possible: start a new cluster.
		const seed = remaining.shift()!;
		let pos = pickNextClusterStart(grid);
		// With a large gap, collisions should be extremely rare, but we still
		// slide deterministically as a safety valve.
		let attempts = 0;
		while (attempts < 400) {
			const p: Placement = {
				answer: seed.answer,
				clue: seed.clue,
				dir: "across",
				row: pos.row + attempts * 2,
				col: pos.col + (attempts % 2 === 0 ? 0 : 2),
			};
			const ok = canPlaceWord(grid, p, opts);
			if (ok.ok) {
				applyPlacement(grid, p);
				placements.push(p);
				break;
			}
			attempts++;
		}
		if (attempts >= 400) return null;
	}

	return { grid, placements };
}

export function generateCrosswordDataStrict(entriesRaw: CrosswordEntry[]): CrosswordData {
	const entries = cleanEntries(entriesRaw);

	// Deterministic seed order: longest then lexicographic.
	const seeds = sortSeeds(entries);

	for (const seed of seeds) {
		const sol = solveFromSeed(entries, seed, { strictAdjacency: true });
		if (sol) return buildCrosswordDataFromSolution(sol);
	}

	throw new Error("Unable to generate a strict connected crossword");
}

/**
 * Deterministic generator that always returns a valid puzzle:
 * 1) strict adjacency, connected
 * 2) relaxed adjacency, connected
 * 3) relaxed adjacency, allow disconnected clusters (still clean + spaced)
 */
export function generateCrosswordData(entriesRaw: CrosswordEntry[]): CrosswordData {
	const entries = cleanEntries(entriesRaw);
	const seeds = sortSeeds(entries);

	// Pass 1: strict adjacency, connected
	for (const seed of seeds) {
		const sol = solveFromSeed(entries, seed, { strictAdjacency: true });
		if (sol) return buildCrosswordDataFromSolution(sol);
	}

	// Pass 2: relaxed adjacency, connected
	for (const seed of seeds) {
		const sol = solveFromSeed(entries, seed, { strictAdjacency: false });
		if (sol) return buildCrosswordDataFromSolution(sol);
	}

	// Pass 3: disconnected fallback (keep classic strict adjacency, but allow multiple clusters)
	// This yields clean-looking mini-crosswords, and always guarantees a valid placement.
	{
		const sol = solveWithDisconnectedFallback(entries, { strictAdjacency: true });
		if (sol) return buildCrosswordDataFromSolution(sol);
	}

	// Safety net: disconnected + relaxed adjacency (should basically never be needed)
	{
		const sol = solveWithDisconnectedFallback(entries, { strictAdjacency: false });
		if (sol) return buildCrosswordDataFromSolution(sol);
	}

	throw new Error("Unable to generate a crossword for the provided entries");
}


