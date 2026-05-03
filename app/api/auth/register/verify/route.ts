import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import {
	clearChallengeCookie,
	readChallengeCookie,
	rpInfoFromRequest,
	setSessionCookie,
} from "@/lib/session";
import { saveCredential } from "@/lib/passkey";

export const runtime = "nodejs";

export async function POST(req: Request) {
	const { rpID, origin } = rpInfoFromRequest(req);
	const challenge = await readChallengeCookie();
	if (!challenge?.userId) {
		return NextResponse.json({ error: "Challenge missing or expired" }, { status: 400 });
	}

	const attResp = await req.json();

	let verification;
	try {
		verification = await verifyRegistrationResponse({
			response: attResp,
			expectedChallenge: challenge.challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			requireUserVerification: false,
		});
	} catch (e) {
		return NextResponse.json(
			{ error: e instanceof Error ? e.message : "verification failed" },
			{ status: 400 }
		);
	}

	if (!verification.verified || !verification.registrationInfo) {
		return NextResponse.json({ error: "Not verified" }, { status: 400 });
	}

	const { credential } = verification.registrationInfo;
	await saveCredential({
		id: credential.id,
		user_id: challenge.userId,
		public_key: Buffer.from(credential.publicKey).toString("base64url"),
		counter: credential.counter,
		transports: credential.transports ?? null,
	});

	await clearChallengeCookie();
	await setSessionCookie(challenge.userId);
	return NextResponse.json({ ok: true, userId: challenge.userId });
}
