import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { generateForDate } from "@/lib/contentGenerator";
import { generateCrosswordData } from "@/lib/crossword/generate";

export const runtime = "nodejs";
export const maxDuration = 300;

function addDays(ymd: string, n: number): string {
	const [y, m, d] = ymd.split("-").map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d));
	dt.setUTCDate(dt.getUTCDate() + n);
	return dt.toISOString().slice(0, 10);
}

function todaySa(): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Africa/Johannesburg",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

function authorized(req: Request): boolean {
	const expected = process.env.ADMIN_TOKEN;
	if (!expected) return false;
	const got = req.headers.get("x-admin-token") ?? new URL(req.url).searchParams.get("token");
	return got === expected;
}

/**
 * POST /api/admin/generate?days=7&start=YYYY-MM-DD&overwrite=false
 * Header: x-admin-token: <ADMIN_TOKEN>
 *
 * Generates content for `days` consecutive days starting at `start` (default today).
 * Skips dates that already have a row unless `overwrite=true`.
 */
export async function POST(req: Request) {
	if (!authorized(req)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const url = new URL(req.url);
	const days = Math.max(1, Math.min(60, Number(url.searchParams.get("days") ?? "7")));
	const start = url.searchParams.get("start") ?? todaySa();
	const overwrite = url.searchParams.get("overwrite") === "true";

	const admin = getAdminClient();
	const dates = Array.from({ length: days }, (_, i) => addDays(start, i));

	const { data: existing } = await admin
		.from("experiences")
		.select("date,wordle_answer,crossword_entries")
		.in("date", dates);
	const existingMap = new Map<string, { wordle_answer: string; entries: string[] }>();
	for (const row of existing ?? []) {
		const r = row as { date: string; wordle_answer?: string; crossword_entries?: Array<{ answer?: string }> };
		existingMap.set(r.date, {
			wordle_answer: r.wordle_answer ?? "",
			entries: (r.crossword_entries ?? []).map((e) => String(e?.answer ?? "")),
		});
	}

	// Recent history (14 days before `start`) to avoid repeats.
	const historyStart = addDays(start, -14);
	const { data: history } = await admin
		.from("experiences")
		.select("date,wordle_answer,crossword_entries")
		.gte("date", historyStart)
		.lt("date", start);
	const recent = (history ?? []).map((row) => {
		const r = row as { wordle_answer?: string; crossword_entries?: Array<{ answer?: string }> };
		return {
			wordle_answer: r.wordle_answer ?? "",
			entries: (r.crossword_entries ?? []).map((e) => String(e?.answer ?? "")),
		};
	});

	const results: Array<{ date: string; status: "generated" | "skipped" | "error"; error?: string }> = [];

	for (const date of dates) {
		if (existingMap.has(date) && !overwrite) {
			results.push({ date, status: "skipped" });
			continue;
		}
		try {
			const exp = await generateForDate({ date, recent });
			const crossword_data = generateCrosswordData(exp.crossword_entries);
			const { error } = await admin
				.from("experiences")
				.upsert(
					{
						date,
						wordle_answer: exp.wordle_answer,
						crossword_entries: exp.crossword_entries,
						crossword_data,
						reward_text: exp.reward_text,
						updated_at: new Date().toISOString(),
					},
					{ onConflict: "date" }
				);
			if (error) throw new Error(error.message);
			recent.push({ wordle_answer: exp.wordle_answer, entries: exp.crossword_entries.map((e) => e.answer) });
			results.push({ date, status: "generated" });
		} catch (e) {
			results.push({ date, status: "error", error: e instanceof Error ? e.message : String(e) });
		}
	}

	return NextResponse.json({ results });
}
