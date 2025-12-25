// Random number generator utilities
export function createId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomDelta(range: number): number {
  return Math.floor((Math.random() * 2 - 1) * range);
}
