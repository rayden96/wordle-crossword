export type Experience = {
	id: string;
	date: string; // YYYY-MM-DD
	wordle_answer: string;
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


