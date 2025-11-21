// Match simulation logic
export interface Wrestler {
  name: string;
  weight: number;
  top: number;
  bottom: number;
  neutral: number;
  strength: number;
  conditioning: number;
  technique: number;
}

export function simulateMatch(a: Wrestler, b: Wrestler): string {
  const aSkill = a.neutral + a.top + a.bottom + a.technique + a.strength * 0.5;
  const bSkill = b.neutral + b.top + b.bottom + b.technique + b.strength * 0.5;
  const result = aSkill + Math.random() * 10 > bSkill + Math.random() * 10 ? a.name : b.name;
  return `${result} wins!`;
}