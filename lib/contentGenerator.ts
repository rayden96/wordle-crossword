import Anthropic from "@anthropic-ai/sdk";
import { playerProfile, type PlayerProfile } from "@/lib/profile";
import { generateCrosswordData } from "@/lib/crossword/generate";

export type GeneratedExperience = {
	wordle_answer: string;
	crossword_entries: Array<{ answer: string; clue: string }>;
	reward_text: string;
};

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

const SYSTEM = `You generate daily puzzle content for a personalised gift website.
Output ONLY valid JSON matching this shape — no prose, no markdown fences:

{
  "wordle_answer": "FIVELETTERS",
  "crossword_entries": [
    { "answer": "WORD", "clue": "Clue text" },
    ...
  ],
  "reward_text": "A short, warm love-note (2-4 sentences) themed to the day."
}

Rules:
- wordle_answer: a real, common 5-letter English word, all caps, no proper nouns.
- crossword_entries: exactly 7 entries. Answers are 3-8 letters, A-Z only (no spaces/hyphens/apostrophes). Mix of lengths so they can interlock — at least three answers must share at least one letter with two other answers. Avoid plurals ending in S and answers that are all the same letter.
- Clues are concise (under 60 chars), playful, and lean on the player's profile (interests, inside jokes, places). At least 3 clues should reference profile items directly.
- reward_text: a 2-4 sentence note in the player's tone, addressed to them by a pet name. Reference at least one profile item. End with the configured signoff.
- All answers must be unique within the day.`;

function buildUserPrompt(profile: PlayerProfile, date: string, recent: Array<{ wordle_answer: string; entries: string[] }>) {
	return `Date: ${date}

Player profile:
${JSON.stringify(profile, null, 2)}

Avoid these recently used answers (last 14 days):
- wordle: ${recent.map((r) => r.wordle_answer).filter(Boolean).join(", ") || "(none)"}
- crossword: ${recent.flatMap((r) => r.entries).join(", ") || "(none)"}

Return the JSON now.`;
}

function extractJson(text: string): unknown {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const raw = fenced ? fenced[1] : text;
	const start = raw.indexOf("{");
	const end = raw.lastIndexOf("}");
	if (start === -1 || end === -1) throw new Error("No JSON object in model output");
	return JSON.parse(raw.slice(start, end + 1));
}

function validate(parsed: unknown): GeneratedExperience {
	const obj = parsed as Record<string, unknown>;
	const wordle = String(obj?.wordle_answer ?? "").toUpperCase().replace(/[^A-Z]/g, "");
	if (wordle.length !== 5) throw new Error(`wordle_answer must be 5 letters, got "${wordle}"`);

	const entriesRaw = obj?.crossword_entries;
	if (!Array.isArray(entriesRaw) || entriesRaw.length < 5) {
		throw new Error("crossword_entries must be an array of >=5 items");
	}
	const entries = entriesRaw.map((e) => {
		const r = e as Record<string, unknown>;
		const answer = String(r?.answer ?? "").toUpperCase().replace(/[^A-Z]/g, "");
		const clue = String(r?.clue ?? "").trim();
		if (answer.length < 3 || answer.length > 10) throw new Error(`bad answer "${answer}"`);
		if (!clue) throw new Error(`empty clue for "${answer}"`);
		return { answer, clue };
	});
	const seen = new Set<string>();
	for (const e of entries) {
		if (seen.has(e.answer)) throw new Error(`duplicate answer ${e.answer}`);
		seen.add(e.answer);
	}

	const reward = String(obj?.reward_text ?? "").trim();
	if (!reward) throw new Error("reward_text is empty");

	return { wordle_answer: wordle, crossword_entries: entries, reward_text: reward };
}

export async function generateForDate(opts: {
	date: string;
	recent?: Array<{ wordle_answer: string; entries: string[] }>;
	apiKey?: string;
}): Promise<GeneratedExperience> {
	const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

	const client = new Anthropic({ apiKey });
	const userMsg = buildUserPrompt(playerProfile, opts.date, opts.recent ?? []);

	let lastErr: Error | null = null;
	for (let attempt = 0; attempt < 3; attempt++) {
		const res = await client.messages.create({
			model: MODEL,
			max_tokens: 2048,
			system: SYSTEM,
			messages: [{ role: "user", content: userMsg }],
		});
		const text = res.content
			.filter((b): b is Anthropic.TextBlock => b.type === "text")
			.map((b) => b.text)
			.join("\n");
		try {
			const parsed = extractJson(text);
			const valid = validate(parsed);
			// Sanity: layout must actually generate.
			generateCrosswordData(valid.crossword_entries);
			return valid;
		} catch (e) {
			lastErr = e instanceof Error ? e : new Error(String(e));
			// Surface the underlying cause (network error, status, etc.) instead of just "Connection error".
			const cause = (e as { cause?: unknown })?.cause;
			const status = (e as { status?: number })?.status;
			const detail = [
				lastErr.message,
				status ? `status=${status}` : null,
				cause ? `cause=${cause instanceof Error ? cause.message : String(cause)}` : null,
			]
				.filter(Boolean)
				.join(" | ");
			lastErr = new Error(detail);
		}
	}
	throw new Error(`Generation failed after retries: ${lastErr?.message}`);
}
