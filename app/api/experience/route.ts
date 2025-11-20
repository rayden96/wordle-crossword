import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const date = searchParams.get("date");
	const targetDate =
		date && /^\d{4}-\d{2}-\d{2}$/.test(date)
			? date
			: new Date().toISOString().slice(0, 10);

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
	return NextResponse.json(data);
}


