#!/usr/bin/env node
/**
 * Local CLI to generate N days of content. Reads .env.local for keys.
 *
 * Usage:
 *   node scripts/generate-content.mjs            # 7 days starting today (Africa/Johannesburg)
 *   node scripts/generate-content.mjs --days 30
 *   node scripts/generate-content.mjs --start 2026-05-10 --days 14 --overwrite
 *
 * Requires ANTHROPIC_API_KEY plus the Supabase env vars in .env.local.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
	try {
		const txt = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
		for (const line of txt.split(/\r?\n/)) {
			const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
			if (!m) continue;
			let v = m[2];
			if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
			if (!process.env[m[1]]) process.env[m[1]] = v;
		}
	} catch {
		// no .env.local — rely on process env
	}
}

function parseArgs(argv) {
	const out = { days: 7, start: undefined, overwrite: false };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--days") out.days = Number(argv[++i]);
		else if (a === "--start") out.start = argv[++i];
		else if (a === "--overwrite") out.overwrite = true;
	}
	return out;
}

function todaySa() {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Africa/Johannesburg",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

function addDays(ymd, n) {
	const [y, m, d] = ymd.split("-").map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d));
	dt.setUTCDate(dt.getUTCDate() + n);
	return dt.toISOString().slice(0, 10);
}

async function main() {
	loadEnv();
	const args = parseArgs(process.argv);
	const start = args.start ?? todaySa();

	const required = ["ANTHROPIC_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
	const missing = required.filter((k) => !process.env[k]);
	if (missing.length) {
		console.error("Missing env vars:", missing.join(", "));
		process.exit(1);
	}

	// Use tsx if installed, otherwise spawn the Next route locally? Simpler: import compiled via dynamic import after running through TypeScript.
	// We rely on running this from `npm run gen` which uses tsx.
	const { generateForDate } = await import("../lib/contentGenerator.ts");
	const { generateCrosswordData } = await import("../lib/crossword/generate.ts");
	const { createClient } = await import("@supabase/supabase-js");

	const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
		auth: { persistSession: false, autoRefreshToken: false },
	});

	const dates = Array.from({ length: args.days }, (_, i) => addDays(start, i));
	const { data: existing } = await admin.from("experiences").select("date").in("date", dates);
	const existingSet = new Set((existing ?? []).map((r) => r.date));

	const historyStart = addDays(start, -14);
	const { data: history } = await admin
		.from("experiences")
		.select("date,wordle_answer,crossword_entries")
		.gte("date", historyStart)
		.lt("date", start);
	const recent = (history ?? []).map((r) => ({
		wordle_answer: r.wordle_answer ?? "",
		entries: (r.crossword_entries ?? []).map((e) => String(e?.answer ?? "")),
	}));

	for (const date of dates) {
		if (existingSet.has(date) && !args.overwrite) {
			console.log(`[skip] ${date} already exists`);
			continue;
		}
		try {
			console.log(`[gen]  ${date} ...`);
			const exp = await generateForDate({ date, recent });
			const crossword_data = generateCrosswordData(exp.crossword_entries);
			const { error } = await admin.from("experiences").upsert(
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
			console.log(`       wordle=${exp.wordle_answer}  entries=${exp.crossword_entries.length}`);
		} catch (e) {
			console.error(`[err]  ${date}: ${e instanceof Error ? e.message : e}`);
		}
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
