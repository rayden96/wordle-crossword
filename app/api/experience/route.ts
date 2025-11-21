import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

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
	return NextResponse.json(data);
}


