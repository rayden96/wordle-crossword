export function todayYmd(local = true) {
	const d = new Date();
	if (!local) {
		return d.toISOString().slice(0, 10);
	}
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}


