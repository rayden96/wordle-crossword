import { NextResponse } from "next/server";

// Simple server-side validation using dictionaryapi.dev
// Returns { valid: boolean }
export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const word = (searchParams.get("word") || "").toLowerCase().trim();
	if (!word || !/^[a-z]+$/.test(word)) {
		return NextResponse.json({ valid: false });
	}
	try {
		const r = await fetch(
			`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
				word
			)}`
		);
		// 200 → valid word; 404 → not found
		return NextResponse.json({ valid: r.ok });
	} catch {
		// On network/API issues, be lenient and allow the guess.
		return NextResponse.json({ valid: true });
	}
}


