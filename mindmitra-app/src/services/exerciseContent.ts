import type { ExerciseCode } from './activityCatalog';
export type ExerciseConfig = { seconds: number; mode: 'breathing' | 'writing' | 'guided' | 'focus' | 'recall'; intro: string; steps: string[]; prompts?: string[] };
export const EXERCISES: Record<ExerciseCode, ExerciseConfig> = {
  e1: { seconds: 300, mode: 'breathing', intro: 'Breathe gently and comfortably. Follow the circle if it feels helpful; keep your natural pace whenever you prefer. No breath holding is needed.', steps: ['Sit comfortably and relax your shoulders.', 'Breathe in gently, without forcing the breath.', 'Breathe out gently and continue at a comfortable pace.'] },
  e2: { seconds: 0, mode: 'writing', intro: 'Take a moment to reflect. Your writing stays in this screen and is discarded when you leave; only completion and active time are saved.', steps: [], prompts: ['What is on your mind, and what would help you today?'] },
  e3: { seconds: 180, mode: 'guided', intro: 'Use a stable chair and move only within a comfortable range. Skip any movement that does not suit you, and stop if it is uncomfortable.', steps: ['Sit comfortably with your feet on the floor. Let your shoulders settle.', 'Gently move your shoulders back and down, then relax. Breathe normally.', 'Slowly open and close your hands. Rest your arms comfortably.', 'If comfortable, gently lift and lower one heel, then the other. Finish by resting.'] },
  e4: { seconds: 1500, mode: 'focus', intro: 'Choose one manageable task and put distractions aside. Pause whenever you need a break. The timer counts only active time.', steps: ['Settle into one task. You can return to it gently when your attention wanders.'] },
  e5: { seconds: 300, mode: 'guided', intro: 'This is a gentle seated practice. Keep breathing normally, use a stable chair, and skip any pose that feels uncomfortable.', steps: ['Seated mountain: place your feet on the floor and sit comfortably upright.', 'Let your shoulders soften. Rest your hands on your thighs and breathe normally.', 'If comfortable, slowly reach one arm upward within your easy range. Lower it and rest, then try the other arm.', 'Return both hands to your thighs. Rest in a comfortable seated position.'] },
  el1: { seconds: 300, mode: 'guided', intro: 'Sit comfortably with your eyes open or closed. There is no need to empty your mind; simply notice and return gently.', steps: ['Notice the support of your chair and the room around you.', 'Bring attention to your natural breath without changing it.', 'If thoughts appear, notice them and return to the next breath.', 'Notice sounds around you, then settle again.', 'Let your attention widen. Finish at your own pace.'] },
  el2: { seconds: 300, mode: 'guided', intro: 'Notice sensations without trying to change them. You can skip any area, keep your eyes open, or pause at any time.', steps: ['Notice your feet and their contact with the floor.', 'Bring attention to your lower legs and knees.', 'Notice your thighs and the support under you.', 'Notice your hands and arms at rest.', 'Notice your shoulders, jaw and face without forcing relaxation.', 'Bring attention back to the room and your whole body.'] },
  el3: { seconds: 0, mode: 'writing', intro: 'Choose three small, specific things. Ordinary moments count. Your words stay in this screen; only completion and active time are saved.', steps: [], prompts: ['A small thing I appreciated today', 'A person, place or moment I value', 'Something I am looking forward to'] },
  el4: { seconds: 0, mode: 'recall', intro: 'Look at five everyday words, hide them, and write down the ones you remember. This is practice, not a diagnosis or a test of your health. Your answers are not saved.', steps: [] },
  el5: { seconds: 120, mode: 'guided', intro: 'Take a comfortable break from looking closely at a screen. Do not press or rub your eyes. Keep blinking naturally.', steps: ['Look away from the screen at a comfortable distant object for about 20 seconds.', 'Blink naturally and let your gaze move around the room.', 'If comfortable, rest with your eyes gently closed for a moment, then open them.', 'Look into the distance again and return to near work when ready.'] },
};
export class ActiveClock {
  private accumulated = 0;
  private since: number | null = null;
  resume(now: number) { if (this.since === null) this.since = now; }
  elapsed(now: number) { return this.accumulated + (this.since === null ? 0 : Math.max(0, now - this.since)); }
  pause(now: number) { this.accumulated = this.elapsed(now); this.since = null; }
}
export const RECALL_WORDS = ['River', 'Lantern', 'Mango', 'Bicycle', 'Garden', 'Window', 'Pencil', 'Basket', 'Cloud', 'Ticket', 'Pillow', 'Ocean', 'Button', 'Forest', 'Mirror'];
export function recallCount(answer: string, words: string[]) {
  const supplied = new Set(answer.toLowerCase().split(/[^a-z]+/).filter(Boolean));
  return words.filter(word => supplied.has(word.toLowerCase())).length;
}
