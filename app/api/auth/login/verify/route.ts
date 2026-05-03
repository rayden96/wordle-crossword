import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import {
	clearChallengeCookie,
	readChallengeCookie,
	rpInfoFromRequest,
	setSessionCookie,
} from "@/lib/session";
import { getCredentialById, updateCounter } from "@/lib/passkey";

export const runtime = "nodejs";

export async function POST(req: Request) {
	const { rpID, origin } = rpInfoFromRequest(req);
	const challenge = await readChallengeCookie();
	if (!challenge) {
		return NextResponse.json({ error: "Challenge missing" }, { status: 400 });
	}

	const authResp = await req.json();
	const credId = String(authResp?.id ?? "");
	const stored = await getCredentialById(credId);
	if (!stored) return NextResponse.json({ error: "Unknown credential" }, { status: 400 });

	let verification;
	try {
		verification = await verifyAuthenticationResponse({
			response: authResp,
			expectedChallenge: challenge.challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			credential: {
				id: stored.id,
				publicKey: new Uint8Array(Buffer.from(stored.public_key, "base64url")),
				counter: stored.counter,
				transports: (stored.transports ?? undefined) as AuthenticatorTransport[] | undefined,
			},
			requireUserVerification: false,
		});
	} catch (e) {
		return NextResponse.json(
			{ error: e instanceof Error ? e.message : "verification failed" },
			{ status: 400 }
		);
	}

	if (!verification.verified) {
		return NextResponse.json({ error: "Not verified" }, { status: 400 });
	}

	await updateCounter(stored.id, verification.authenticationInfo.newCounter);
	await clearChallengeCookie();
	await setSessionCookie(stored.user_id);
	return NextResponse.json({ ok: true, userId: stored.user_id });
}
