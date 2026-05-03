// MonkeyBeanGames service worker — minimal offline shell.
const VERSION = "v1";
const SHELL = `mbg-shell-${VERSION}`;
const RUNTIME = `mbg-runtime-${VERSION}`;

const SHELL_URLS = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting())
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys
					.filter((k) => k !== SHELL && k !== RUNTIME)
					.map((k) => caches.delete(k))
			)
		).then(() => self.clients.claim())
	);
});

self.addEventListener("fetch", (event) => {
	const req = event.request;
	if (req.method !== "GET") return;
	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;

	// Never cache API or auth — always go to network.
	if (url.pathname.startsWith("/api/")) return;

	// HTML navigations: network-first with shell fallback.
	if (req.mode === "navigate") {
		event.respondWith(
			fetch(req)
				.then((res) => {
					const copy = res.clone();
					caches.open(RUNTIME).then((c) => c.put(req, copy));
					return res;
				})
				.catch(() => caches.match(req).then((m) => m || caches.match("/")))
		);
		return;
	}

	// Static assets: cache-first.
	if (/\.(?:js|css|woff2?|svg|png|jpg|jpeg|gif|webp|ico)$/.test(url.pathname)) {
		event.respondWith(
			caches.match(req).then(
				(cached) =>
					cached ||
					fetch(req).then((res) => {
						const copy = res.clone();
						caches.open(RUNTIME).then((c) => c.put(req, copy));
						return res;
					})
			)
		);
	}
});
