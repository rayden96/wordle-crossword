import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabaseAdmin";

// GET /api/progress?code=ABC123&date=YYYY-MM-DD
export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const code = searchParams.get("code")?.trim();
	const date = searchParams.get("date")?.trim();
	if (!code || !date) {
		return NextResponse.json({ error: "Missing code or date" }, { status: 400 });
	}
	const supabase = getAdminClient();
	const { data, error } = await supabase
		.from("progress")
		.select("*")
		.eq("code", code)
		.eq("date", date)
		.maybeSingle();
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	return NextResponse.json(
		data ?? {
			code,
			date,
			wordle_completed: false,
			crossword_completed: false,
		}
	);
}

// POST /api/progress { code, date, wordleCompleted?, crosswordCompleted? }
export async function POST(req: Request) {
	const body = await req.json().catch(() => ({}));
	const code = String(body.code ?? "").trim();
	const date = String(body.date ?? "").trim();
	const wordleCompleted = Boolean(body.wordleCompleted);
	const crosswordCompleted = Boolean(body.crosswordCompleted);
	if (!code || !date) {
		return NextResponse.json({ error: "Missing code or date" }, { status: 400 });
	}
	const supabase = getAdminClient();
	// Upsert progress
	const { data, error } = await supabase
		.from("progress")
		.upsert(
			{
				code,
				date,
				wordle_completed: wordleCompleted,
				crossword_completed: crosswordCompleted,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "code,date" }
		)
		.select()
		.single();
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	return NextResponse.json(data);
}


