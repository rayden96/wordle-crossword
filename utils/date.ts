export function todayYmd(timeZone: string = "Africa/Johannesburg") {
	// Use a fixed timezone (South Africa) to determine "today"
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	return formatter.format(new Date()); // en-CA => YYYY-MM-DD
}


