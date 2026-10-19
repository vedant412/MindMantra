export type GameCode = 'g1' | 'g2' | 'g3' | 'g4' | 'gl1' | 'gl2' | 'gl3' | 'gl4' | 'gl5';
export type ExerciseCode = 'e1' | 'e2' | 'e3' | 'e4' | 'e5' | 'el1' | 'el2' | 'el3' | 'el4' | 'el5';
export type ActivityCode = GameCode | ExerciseCode;
export type Activity = { id: ActivityCode; title: string; category: 'Games' | 'Exercise'; duration: string; description: string; icon: string };
export const ACTIVITIES: Activity[] = [
  { id: 'g1', title: 'Pattern Recall', category: 'Games', duration: '5 rounds', description: 'Watch a sequence, then repeat it.', icon: 'grid' },
  { id: 'g2', title: 'Tap Reaction Test', category: 'Games', duration: '3 rounds', description: 'Wait for green, then tap.', icon: 'flash' },
  { id: 'g3', title: 'Stroop Test', category: 'Games', duration: '5 rounds', description: 'Choose the ink color, not the word.', icon: 'color-palette' },
  { id: 'g4', title: 'Number Sequence', category: 'Games', duration: '5 rounds', description: 'Tap the numbers in ascending order.', icon: 'keypad' },
  { id: 'gl1', title: 'Number Memory', category: 'Games', duration: '5 rounds', description: 'Remember an increasingly long number.', icon: 'calculator' },
  { id: 'gl2', title: 'Card Match', category: 'Games', duration: '5 pairs', description: 'Find matching cards in up to 20 attempts.', icon: 'albums' },
  { id: 'gl3', title: 'Speed Sorting', category: 'Games', duration: '5 rounds', description: 'Sort each number as odd or even.', icon: 'swap-horizontal' },
  { id: 'gl4', title: 'Find the Target', category: 'Games', duration: '5 rounds', description: 'Spot the different symbol in the grid.', icon: 'search' },
  { id: 'gl5', title: 'Logic Quiz', category: 'Games', duration: '5 questions', description: 'Work through short logic puzzles.', icon: 'help-circle' },
  { id: 'e1', title: 'Breathing Exercise', category: 'Exercise', duration: '1–5 min', description: 'Follow a gentle inhale and exhale rhythm.', icon: 'leaf' },
  { id: 'e2', title: 'Journaling', category: 'Exercise', duration: 'At your pace', description: 'Reflect privately on what is on your mind.', icon: 'book' },
  { id: 'e3', title: 'Stretching Routine', category: 'Exercise', duration: '1–3 min', description: 'Take a short, comfortable movement break.', icon: 'walk' },
  { id: 'e4', title: 'Focus Timer', category: 'Exercise', duration: '5–25 min', description: 'Choose a task and protect a focus block.', icon: 'hourglass' },
  { id: 'e5', title: 'Yoga Poses', category: 'Exercise', duration: '1–5 min', description: 'Try gentle seated postures and rest.', icon: 'body' },
  { id: 'el1', title: 'Meditation Session', category: 'Exercise', duration: '1–5 min', description: 'Notice your breath and return gently.', icon: 'flower' },
  { id: 'el2', title: 'Body Scan', category: 'Exercise', duration: '1–5 min', description: 'Bring attention to different areas of your body.', icon: 'scan' },
  { id: 'el3', title: 'Gratitude Exercise', category: 'Exercise', duration: 'At your pace', description: 'Write three small things you appreciate.', icon: 'heart' },
  { id: 'el4', title: 'Memory Recall Practice', category: 'Exercise', duration: 'At your pace', description: 'Observe five everyday words, then recall them.', icon: 'bulb' },
  { id: 'el5', title: 'Eye Relaxation', category: 'Exercise', duration: '1–2 min', description: 'Pause near work, look into the distance and blink.', icon: 'eye' },
];
export const GAME_CODES = ACTIVITIES.filter(a => a.category === 'Games').map(a => a.id as GameCode);
export const exercisePoints = (code: string, durationMs: number) => code === 'e4' && durationMs >= 25 * 60000 ? 15 : 5;
