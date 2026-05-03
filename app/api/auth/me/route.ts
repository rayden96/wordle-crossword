import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
	const s = await readSession();
	if (!s) return NextResponse.json({ userId: null }, { status: 200 });
	return NextResponse.json({ userId: s.userId });
}
