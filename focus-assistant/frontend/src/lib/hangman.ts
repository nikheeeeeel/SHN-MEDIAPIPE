export const HANGMAN_MAX_PARTS = 6;

export function hangmanParts(reminders: number): number {
  return Math.max(0, Math.min(HANGMAN_MAX_PARTS, Math.floor(reminders)));
}

export function hangmanRemaining(reminders: number): number {
  return HANGMAN_MAX_PARTS - hangmanParts(reminders);
}

export function hasLostHangman(reminders: number): boolean {
  return hangmanParts(reminders) >= HANGMAN_MAX_PARTS;
}
