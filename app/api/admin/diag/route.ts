import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
	const expected = process.env.ADMIN_TOKEN;
	if (!expected) return false;
	const got = req.headers.get("x-admin-token") ?? new URL(req.url).searchParams.get("token");
	return got === expected;
}

function snip(v: string | undefined): { len: number; prefix: string; suffix: string } | null {
	if (!v) return null;
	return { len: v.length, prefix: v.slice(0, 12), suffix: v.slice(-4) };
}

export async function GET(req: Request) {
	if (!authorized(req)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const env = {
		NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
		NEXT_PUBLIC_SUPABASE_ANON_KEY: snip(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
		SUPABASE_SERVICE_ROLE_KEY: snip(process.env.SUPABASE_SERVICE_ROLE_KEY),
		AUTH_SECRET: snip(process.env.AUTH_SECRET),
		ENROLL_SECRET_set: Boolean(process.env.ENROLL_SECRET),
		ANTHROPIC_API_KEY: snip(process.env.ANTHROPIC_API_KEY),
	};

	let db_test: Record<string, unknown> = { ran: false };
	try {
		const admin = getAdminClient();
		const { data, error, count } = await admin
			.from("experiences")
			.select("date", { count: "exact" })
			.limit(5);
		db_test = {
			ran: true,
			count,
			rows: data,
			error: error ? error.message : null,
		};
	} catch (e) {
		db_test = {
			ran: true,
			thrown: e instanceof Error ? e.message : String(e),
		};
	}

	return NextResponse.json({ env, db_test }, { status: 200 });
}
