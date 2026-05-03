import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { rpInfoFromRequest, setChallengeCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
	const { rpID } = rpInfoFromRequest(req);
	const admin = getAdminClient();
	const { data: creds } = await admin
		.from("passkey_credentials")
		.select("id,transports");

	const options = await generateAuthenticationOptions({
		rpID,
		userVerification: "preferred",
		allowCredentials: (creds ?? []).map((c) => ({
			id: (c as { id: string }).id,
			transports: ((c as { transports?: string[] }).transports ?? undefined) as AuthenticatorTransport[] | undefined,
		})),
	});

	await setChallengeCookie({ challenge: options.challenge });
	return NextResponse.json(options);
}
