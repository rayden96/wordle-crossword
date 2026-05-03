"use client";
import { createContext, useContext, useEffect, useState } from "react";

type SessionState = {
	ready: boolean;
	userId: string | null;
	refresh: () => Promise<void>;
	logout: () => Promise<void>;
};

const Ctx = createContext<SessionState>({
	ready: false,
	userId: null,
	refresh: async () => {},
	logout: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
	const [ready, setReady] = useState(false);
	const [userId, setUserId] = useState<string | null>(null);

	const refresh = async () => {
		try {
			const r = await fetch("/api/auth/me", { cache: "no-store" });
			const j = await r.json();
			setUserId(j.userId ?? null);
		} catch {
			setUserId(null);
		} finally {
			setReady(true);
		}
	};

	const logout = async () => {
		await fetch("/api/auth/logout", { method: "POST" });
		setUserId(null);
	};

	useEffect(() => {
		void refresh();
	}, []);

	return <Ctx.Provider value={{ ready, userId, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useSession() {
	return useContext(Ctx);
}
