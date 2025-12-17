export type Experience = {
	id: string;
	date: string; // YYYY-MM-DD
	wordle_answer: string;
	// New input format (preferred): list of entries. The server can generate crossword_data from this.
	crossword_entries?: Array<{ answer: string; clue: string }>;
	crossword_data: {
		across: Record<
			string,
			{ clue: string; answer: string; row: number; col: number }
		>;
		down: Record<
			string,
			{ clue: string; answer: string; row: number; col: number }
		>;
	};
	reward_text: string;
};

export type Progress = {
	code: string;
	date: string; // YYYY-MM-DD
	wordle_completed: boolean;
	crossword_completed: boolean;
};


