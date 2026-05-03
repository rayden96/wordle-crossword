import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { rpInfoFromRequest, setChallengeCookie } from "@/lib/session";
import { getOrCreateUserByLabel, listCredentials } from "@/lib/passkey";

export const runtime = "nodejs";

export async function POST(req: Request) {
	try {
		const { rpID, origin } = rpInfoFromRequest(req);
		void origin;
		const body = await req.json().catch(() => ({}));
		const enrollSecret = String(body.enrollSecret ?? "");
		const label = String(body.label ?? "Monkey Bean").slice(0, 64);

		const expected = process.env.ENROLL_SECRET ?? "BEEPBOOP";
		if (enrollSecret !== expected) {
			return NextResponse.json({ error: "Invalid enrollment secret" }, { status: 401 });
		}

		// Sanity-check env vars before they fail downstream with a cryptic "fetch failed".
		const missing = [
			"NEXT_PUBLIC_SUPABASE_URL",
			"SUPABASE_SERVICE_ROLE_KEY",
			"AUTH_SECRET",
		].filter((k) => !process.env[k]);
		if (missing.length) {
			return NextResponse.json(
				{ error: `Server misconfigured: missing ${missing.join(", ")}` },
				{ status: 500 }
			);
		}

		let user;
		try {
			user = await getOrCreateUserByLabel(label);
		} catch (e) {
			const cause = (e as { cause?: unknown })?.cause;
			return NextResponse.json(
				{
					error: "supabase_user_lookup_failed",
					message: e instanceof Error ? e.message : String(e),
					cause: cause instanceof Error ? cause.message : cause ? String(cause) : undefined,
					url_set: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
					service_role_set: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
				},
				{ status: 500 }
			);
		}

		const existing = await listCredentials(user.id);

		const options = await generateRegistrationOptions({
			rpName: "MonkeyBeanGames",
			rpID,
			userID: new TextEncoder().encode(user.id),
			userName: user.label,
			attestationType: "none",
			authenticatorSelection: {
				residentKey: "preferred",
				userVerification: "preferred",
			},
			excludeCredentials: existing.map((c) => ({
				id: c.id,
				transports: (c.transports ?? undefined) as AuthenticatorTransport[] | undefined,
			})),
		});

		await setChallengeCookie({ challenge: options.challenge, userId: user.id });
		return NextResponse.json(options);
	} catch (e) {
		const cause = (e as { cause?: unknown })?.cause;
		return NextResponse.json(
			{
				error: "options_route_failed",
				message: e instanceof Error ? e.message : String(e),
				cause: cause instanceof Error ? cause.message : cause ? String(cause) : undefined,
			},
			{ status: 500 }
		);
	}
}
