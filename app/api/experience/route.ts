import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { generateCrosswordDataStrict } from "@/lib/crossword/generate";
import { getAdminClient } from "@/lib/supabaseAdmin";

function todaySa() {
	const fmt = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Africa/Johannesburg",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	return fmt.format(new Date());
}

export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const date = searchParams.get("date");
	const targetDate =
		date && /^\d{4}-\d{2}-\d{2}$/.test(date)
			? date
			: todaySa();

	const { data, error } = await supabase
		.from("experiences")
		.select("*")
		.eq("date", targetDate)
		.single();

	if (error) {
		return NextResponse.json(
			{ error: error.message, date: targetDate },
			{ status: 404 }
		);
	}

	// Back-compat: if a legacy row only has crossword_data, just return it.
	// New path: if crossword_entries is present, deterministically generate crossword_data.
	try {
		const entries = (data as { crossword_entries?: unknown })?.crossword_entries;
		if (Array.isArray(entries) && entries.length > 0) {
			const crossword_data = generateCrosswordDataStrict(
				entries as Array<{ answer: string; clue: string }>
			);

			// Server-side cache: if the row doesn't already have crossword_data, store it.
			// This is best-effort; caching failures should not block gameplay.
			try {
				if (!(data as { crossword_data?: unknown })?.crossword_data) {
					const admin = getAdminClient();
					await admin
						.from("experiences")
						.update({
							crossword_data,
							updated_at: new Date().toISOString(),
						})
						.eq("date", targetDate)
						.is("crossword_data", null);
				}
			} catch {
				// Ignore cache errors (missing service role key, RLS, etc.)
			}

			return NextResponse.json({ ...data, crossword_data });
		}
	} catch (e) {
		return NextResponse.json(
			{
				error:
					e instanceof Error ? e.message : "Failed to generate crossword",
				date: targetDate,
			},
			{ status: 500 }
		);
	}

	return NextResponse.json(data);
}


