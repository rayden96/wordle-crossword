"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
	startRegistration,
	startAuthentication,
	browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import CardShell from "@/components/CardShell";
import Loading from "@/components/Loading";
import { useSession } from "@/components/SessionProvider";

export default function Home() {
	const router = useRouter();
	const session = useSession();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [mode, setMode] = useState<"login" | "enroll">("login");
	const [enrollSecret, setEnrollSecret] = useState("");
	const [supported, setSupported] = useState(true);

	useEffect(() => {
		setSupported(browserSupportsWebAuthn());
	}, []);

	useEffect(() => {
		if (session.ready && session.userId) {
			router.replace("/wordle");
		}
	}, [session.ready, session.userId, router]);

	async function login() {
		setBusy(true);
		setError("");
		try {
			const r = await fetch("/api/auth/login/options", { method: "POST" });
			if (!r.ok) throw new Error("No passkeys registered yet — switch to Set up.");
			const opts = await r.json();
			const authResp = await startAuthentication({ optionsJSON: opts });
			const v = await fetch("/api/auth/login/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(authResp),
			});
			if (!v.ok) {
				const j = await v.json().catch(() => ({}));
				throw new Error(j.error ?? "Login failed");
			}
			await session.refresh();
			router.push("/wordle");
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	async function enroll() {
		setBusy(true);
		setError("");
		try {
			const r = await fetch("/api/auth/register/options", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enrollSecret, label: "Monkey Bean" }),
			});
			if (!r.ok) {
				const j = await r.json().catch(() => ({}));
				throw new Error(j.error ?? "Enrollment failed");
			}
			const opts = await r.json();
			const attResp = await startRegistration({ optionsJSON: opts });
			const v = await fetch("/api/auth/register/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(attResp),
			});
			if (!v.ok) {
				const j = await v.json().catch(() => ({}));
				throw new Error(j.error ?? "Verification failed");
			}
			await session.refresh();
			router.push("/wordle");
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<CardShell maxWidthClassName="max-w-md" cardClassName="p-8 shadow-lg">
			<h1 className="text-3xl font-semibold text-rust mb-2">Hello Monkey Bean.</h1>
			<p className="text-rust/70 mb-6">Ready to solve today&apos;s puzzle?</p>

			{!supported && (
				<div className="mb-4 text-sm text-orange">
					This device doesn&apos;t support passkeys. Try a recent browser.
				</div>
			)}

			{mode === "login" ? (
				<>
					<button
						onClick={login}
						disabled={busy || !supported}
						className="w-full bg-orange text-white py-3 rounded-md hover:opacity-95 active:opacity-90 disabled:opacity-50"
					>
						{busy ? "Authenticating…" : "Sign in with passkey"}
					</button>
					<button
						onClick={() => setMode("enroll")}
						className="mt-3 w-full text-sm text-rust/70 hover:text-rust underline-offset-4 hover:underline"
					>
						First time? Set up a passkey →
					</button>
				</>
			) : (
				<>
					<label className="block text-sm text-rust/80 mb-2">Setup code</label>
					<input
						type="password"
						className="w-full rounded-md border border-orange/40 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange/60 bg-cream/30 text-rust"
						value={enrollSecret}
						onChange={(e) => setEnrollSecret(e.target.value)}
						placeholder="Ask Rayden"
					/>
					<button
						onClick={enroll}
						disabled={busy || !supported || !enrollSecret}
						className="mt-4 w-full bg-orange text-white py-3 rounded-md hover:opacity-95 disabled:opacity-50"
					>
						{busy ? "Setting up…" : "Create passkey"}
					</button>
					<button
						onClick={() => setMode("login")}
						className="mt-3 w-full text-sm text-rust/70 hover:text-rust"
					>
						← Back to sign in
					</button>
				</>
			)}

			{error && <div className="mt-4 text-sm text-red-600">{error}</div>}
			{busy && (
				<div className="mt-4">
					<Loading />
				</div>
			)}
		</CardShell>
	);
}
