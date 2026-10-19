import type { GameCode } from './activityCatalog';

export type RoundResult = { correct: boolean; reaction_time_ms?: number };
export type GameResult = { started_at: string; ended_at: string; client_session_id: string; game_version: '2'; round_results: RoundResult[] };
export type Phase = 'intro' | 'memorize' | 'waiting' | 'playing' | 'feedback' | 'pair' | 'result';
export const INK = [ { name: 'RED', color: '#B62030' }, { name: 'BLUE', color: '#205DAA' }, { name: 'GREEN', color: '#207044' }, { name: 'PURPLE', color: '#6B359C' } ];
export const GAME_HELP: Record<GameCode, string> = {
  g1: 'Watch the flashing tiles. Repeat the sequence in the same order. A mistake ends this attempt.',
  g2: 'Wait until the pad turns green, then tap. Complete three trials. An early tap ends the attempt.',
  g3: 'Select the INK COLOR of the displayed word. Ignore what the word says.',
  g4: 'Tap 1, 2, 3 and so on in order. Tiles stay in place. A wrong number ends the attempt.',
  gl1: 'Memorize the number while it is visible. Enter it after it disappears. Leading zeroes count.',
  gl2: 'Preview ten cards, then reveal two at a time. Find all five pairs within 20 attempts. Fewer misses earn more points.',
  gl3: 'Choose whether each number is odd or even. There are five rounds; a mistake ends the attempt.',
  gl4: 'One symbol is different. Find it in each grid. A wrong choice ends the attempt.',
  gl5: 'Choose the answer to each short logic question. There are five questions; a mistake ends the attempt.',
};
export const QUIZ = [
  { q: 'What comes next: 2, 4, 6, 8, …?', choices: ['9', '10', '12', '16'], answer: 1 },
  { q: 'All squares have four sides. This shape is a square. How many sides does it have?', choices: ['3', '4', '5', '6'], answer: 1 },
  { q: 'Which item does not belong?', choices: ['Apple', 'Pear', 'Carrot', 'Peach'], answer: 2 },
  { q: 'If today is Tuesday, what day is two days later?', choices: ['Monday', 'Wednesday', 'Thursday', 'Friday'], answer: 2 },
  { q: 'Maya is older than Ravi. Ravi is older than Dev. Who is youngest?', choices: ['Maya', 'Ravi', 'Dev', 'Cannot tell'], answer: 2 },
  { q: 'What comes next: 1, 3, 5, 7, …?', choices: ['8', '9', '10', '11'], answer: 1 },
  { q: 'Which number is the largest?', choices: ['17', '71', '27', '67'], answer: 1 },
  { q: 'You have three apples and give away one. How many remain?', choices: ['1', '2', '3', '4'], answer: 1 },
  { q: 'What comes next: 3, 6, 12, 24, …?', choices: ['27', '36', '48', '96'], answer: 2 },
  { q: 'Which word is the opposite of empty?', choices: ['Open', 'Large', 'Full', 'Quiet'], answer: 2 },
];
export function shuffle<T>(values: T[], random = Math.random): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
export function gameScore(code: string, rounds: RoundResult[]) {
  if (code === 'gl2') return rounds.length ? Math.floor(rounds.filter(r => r.correct).length * 10 / rounds.length + .5) * 5 : 0;
  return rounds.reduce((total, r) => total + (!r.correct ? 0 : code === 'g2' ? ((r.reaction_time_ms ?? 600000) < 300 ? 15 : (r.reaction_time_ms ?? 600000) < 500 ? 10 : 5) : code === 'g4' ? 15 : 10), 0);
}
export class GameSession {
  phase: Phase = 'intro'; round = 1; results: RoundResult[] = []; pattern: number[] = []; selected: number[] = [];
  grid: number[] = []; matched: number[] = []; digits = ''; word = 0; ink = 0; number = 0; target = 1;
  correctIndex = 0; question = QUIZ[0]; feedback = ''; private questions = [...QUIZ];
  private start = 0; private end = 0; private reactionStart = 0; private id = '';
  constructor(public code: GameCode, private random = Math.random, private now = Date.now) {}
  get score() { return gameScore(this.code, this.results); }
  startGame() {
    this.start = this.now(); this.end = 0; this.id = `${this.start}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    this.round = 1; this.results = []; this.feedback = ''; this.questions = shuffle(QUIZ, this.random); this.prepare();
  }
  private prepare() {
    this.selected = []; this.matched = []; this.target = 1;
    const rand = (max: number) => Math.floor(this.random() * max);
    if (this.code === 'g1') { this.pattern = Array.from({ length: this.round + 2 }, () => rand(9)); this.phase = 'memorize'; }
    else if (this.code === 'g2') this.phase = 'waiting';
    else if (this.code === 'g3') { this.word = rand(4); this.ink = (this.word + 1 + rand(3)) % 4; this.phase = 'playing'; }
    else if (this.code === 'g4') { this.grid = shuffle(Array.from({ length: Math.min(this.round * 3 + 3, 16) }, (_, i) => i + 1), this.random); this.phase = 'playing'; }
    else if (this.code === 'gl1') { this.digits = Array.from({ length: this.round + 2 }, () => rand(10)).join(''); this.phase = 'memorize'; }
    else if (this.code === 'gl2') { this.grid = shuffle([0, 1, 2, 3, 4, 0, 1, 2, 3, 4], this.random); this.phase = 'memorize'; }
    else if (this.code === 'gl3') { this.number = 1 + rand(99); this.phase = 'playing'; }
    else if (this.code === 'gl4') { this.correctIndex = rand(16); this.phase = 'playing'; }
    else { this.question = this.questions[this.round - 1]; this.phase = 'playing'; }
  }
  ready() {
    if (this.phase === 'memorize' || this.phase === 'waiting') { this.reactionStart = this.now(); this.phase = 'playing'; }
  }
  private finishRound(correct: boolean, reactionTime?: number) {
    this.results.push({ correct, ...(reactionTime !== undefined ? { reaction_time_ms: reactionTime } : {}) });
    if (!correct || this.round >= (this.code === 'g2' ? 3 : 5)) { this.feedback = correct ? 'All rounds completed.' : 'That attempt is complete. You can try again whenever you like.'; this.end = this.now(); this.phase = 'result'; }
    else { this.feedback = correct ? 'Correct!' : 'Try the next round'; this.phase = 'feedback'; }
  }
  nextRound() { if (this.phase === 'feedback') { this.round++; this.prepare(); } }
  settlePair() { if (this.phase === 'pair') { this.selected = []; this.phase = 'playing'; } }
  submitNumber(answer: string) { if (this.phase === 'playing' && this.code === 'gl1' && answer.trim()) this.finishRound(answer.trim() === this.digits); }
  choose(value: number) {
    if (this.code === 'g2' && this.phase === 'waiting') { this.finishRound(false); return; }
    if (this.phase !== 'playing') return;
    if (this.code === 'g1') {
      if (value !== this.pattern[this.selected.length]) { this.finishRound(false); return; }
      this.selected.push(value); if (this.selected.length === this.pattern.length) this.finishRound(true);
    } else if (this.code === 'g2') this.finishRound(true, Math.min(600000, Math.max(0, this.now() - this.reactionStart)));
    else if (this.code === 'g3') this.finishRound(value === this.ink);
    else if (this.code === 'g4') {
      if (value < this.target) return;
      if (value !== this.target) { this.finishRound(false); return; }
      if (this.target === this.grid.length) this.finishRound(true); else this.target++;
    } else if (this.code === 'gl2') {
      if (value < 0 || value >= this.grid.length || this.matched.includes(value) || this.selected.includes(value)) return;
      this.selected.push(value);
      if (this.selected.length !== 2) return;
      const correct = this.grid[this.selected[0]] === this.grid[this.selected[1]];
      this.results.push({ correct });
      if (correct) this.matched.push(...this.selected);
      if (this.matched.length === 10 || this.results.length === 20) { this.end = this.now(); this.phase = 'result'; this.feedback = `Matched ${this.matched.length / 2} of 5 pairs in ${this.results.length} attempts.`; }
      else this.phase = 'pair';
    } else if (this.code === 'gl3') this.finishRound(value === this.number % 2);
    else if (this.code === 'gl4') this.finishRound(value === this.correctIndex);
    else if (this.code === 'gl5') this.finishRound(value === this.question.answer);
  }
  result(): GameResult {
    if (this.phase !== 'result') throw new Error('Finish the game before saving.');
    return { started_at: new Date(this.start).toISOString(), ended_at: new Date(this.end).toISOString(), client_session_id: this.id, game_version: '2', round_results: this.results.map(r => ({ ...r })) };
  }
}
