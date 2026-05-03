/**
 * Profile that themes the daily content. Edit the values below to taste.
 * Only the server reads this; nothing here is shipped to the client.
 *
 * The generator uses these to bias word choice, clue tone, and the love-note
 * reward text. Keep it specific — vague profiles produce vague puzzles.
 */
export type PlayerProfile = {
	name: string;
	pet_names: string[];
	interests: string[];
	inside_jokes: string[];
	favourite_things: string[];
	places: string[];
	tone: string;
	signoff: string;
};

export const playerProfile: PlayerProfile = {
	name: "Monkey Bean",
	pet_names: ["Cutie"],
	interests: [
		"Anime", "games like dave the diver, animal crossing, etc", "art", "reading", 
	],
	inside_jokes: [
		"she has a big butt"
	],
	favourite_things: [
		"popcorn", "prawn chips", "cheese"
	],
	places: [
		"South Africa", "germany", "netherlands"
	],
	tone: "warm, playful, a little cheeky",
	signoff: "love you",
};
