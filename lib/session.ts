import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "xw_session";
const CHALLENGE_COOKIE = "xw_challenge";
const SESSION_TTL_SEC = 60 * 60 * 24 * 90; // 90 days
const CHALLENGE_TTL_SEC = 60 * 5;

function secret(): string {
	const s = process.env.AUTH_SECRET;
	if (!s || s.length < 16) {
		throw new Error("AUTH_SECRET must be set (min 16 chars)");
	}
	return s;
}

function sign(payload: string): string {
	return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function pack(payload: string): string {
	return `${payload}.${sign(payload)}`;
}

function unpack(token: string | undefined): string | null {
	if (!token) return null;
	const idx = token.lastIndexOf(".");
	if (idx <= 0) return null;
	const payload = token.slice(0, idx);
	const sigB64 = token.slice(idx + 1);
	const expected = Buffer.from(sign(payload), "base64url");
	const got = Buffer.from(sigB64, "base64url");
	if (expected.length !== got.length) return null;
	if (!timingSafeEqual(expected, got)) return null;
	return payload;
}

export type Session = { userId: string; exp: number };

export async function setSessionCookie(userId: string) {
	const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
	const value = pack(`${userId}|${exp}`);
	const jar = await cookies();
	jar.set(SESSION_COOKIE, value, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_TTL_SEC,
	});
}

export async function clearSessionCookie() {
	const jar = await cookies();
	jar.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<Session | null> {
	const jar = await cookies();
	const c = jar.get(SESSION_COOKIE)?.value;
	const payload = unpack(c);
	if (!payload) return null;
	const [userId, expS] = payload.split("|");
	const exp = Number(expS);
	if (!userId || !exp || exp * 1000 < Date.now()) return null;
	return { userId, exp };
}

export type ChallengePayload = { challenge: string; userId?: string };

export async function setChallengeCookie(payload: ChallengePayload) {
	const exp = Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SEC;
	const raw = `${payload.challenge}|${payload.userId ?? ""}|${exp}`;
	const value = pack(raw);
	const jar = await cookies();
	jar.set(CHALLENGE_COOKIE, value, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: CHALLENGE_TTL_SEC,
	});
}

export async function readChallengeCookie(): Promise<ChallengePayload | null> {
	const jar = await cookies();
	const c = jar.get(CHALLENGE_COOKIE)?.value;
	const payload = unpack(c);
	if (!payload) return null;
	const [challenge, userId, expS] = payload.split("|");
	const exp = Number(expS);
	if (!challenge || !exp || exp * 1000 < Date.now()) return null;
	return { challenge, userId: userId || undefined };
}

export async function clearChallengeCookie() {
	const jar = await cookies();
	jar.delete(CHALLENGE_COOKIE);
}

export function rpInfoFromRequest(req: Request): { rpID: string; origin: string } {
	const url = new URL(req.url);
	return {
		rpID: url.hostname,
		origin: `${url.protocol}//${url.host}`,
	};
}
