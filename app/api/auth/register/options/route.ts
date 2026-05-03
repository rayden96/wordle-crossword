import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { rpInfoFromRequest, setChallengeCookie } from "@/lib/session";
import { getOrCreateUserByLabel, listCredentials } from "@/lib/passkey";

export const runtime = "nodejs";

export async function POST(req: Request) {
	const { rpID, origin } = rpInfoFromRequest(req);
	void origin;
	const body = await req.json().catch(() => ({}));
	const enrollSecret = String(body.enrollSecret ?? "");
	const label = String(body.label ?? "Monkey Bean").slice(0, 64);

	const expected = process.env.ENROLL_SECRET ?? "BEEPBOOP";
	if (enrollSecret !== expected) {
		return NextResponse.json({ error: "Invalid enrollment secret" }, { status: 401 });
	}

	const user = await getOrCreateUserByLabel(label);
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
}
