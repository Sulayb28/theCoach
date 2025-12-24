// Match simulation logic
export type WinMethod = "decision" | "major" | "tech fall" | "pin";

export interface Wrestler {
  id: string;
  name: string;
  weight: number;
  weightClass: number;
  neutral: number;
  top: number;
  bottom: number;
  strength: number;
  conditioning: number;
  technique: number;
  morale?: number;
  health?: number;
  fatigue?: number;
  classYear?: "FR" | "SO" | "JR" | "SR";
  potential?: number;
  injury?: { type: "minor" | "moderate" | "major"; days: number };
  form?: number;
  formDays?: number;
}

export function simulateMatch(
  a: Wrestler,
  b: Wrestler
): { winner: Wrestler; loser: Wrestler; method: WinMethod; summary: string } {
  const aFatigue = a.fatigue || 20;
  const bFatigue = b.fatigue || 20;
  const aHealth = a.health || 100;
  const bHealth = b.health || 100;
  const aMorale = a.morale || 70;
  const bMorale = b.morale || 70;

  const aInjuryPenalty =
    a.injury && a.injury.days > 0
      ? a.injury.type === "major"
        ? 0.6
        : a.injury.type === "moderate"
        ? 0.8
        : 0.9
      : 1;
  const bInjuryPenalty =
    b.injury && b.injury.days > 0
      ? b.injury.type === "major"
        ? 0.6
        : b.injury.type === "moderate"
        ? 0.8
        : 0.9
      : 1;

  const aStyle = a.neutral * 0.3 + a.top * 0.25 + a.bottom * 0.2 + a.technique * 0.25;
  const bStyle = b.neutral * 0.3 + b.top * 0.25 + b.bottom * 0.2 + b.technique * 0.25;

  const aBase =
    (overallScore(a) + aStyle * 0.05 + (aMorale - 70) * 0.1 + (aHealth - 90) * 0.05 - aFatigue * 0.1 + (a.form || 0) * 1.2) *
    aInjuryPenalty;
  const bBase =
    (overallScore(b) + bStyle * 0.05 + (bMorale - 70) * 0.1 + (bHealth - 90) * 0.05 - bFatigue * 0.1 + (b.form || 0) * 1.2) *
    bInjuryPenalty;

  const strategyMod = 1; // neutral baseline

  const aScore = aBase * strategyMod + Math.random() * 10;
  const bScore = bBase + Math.random() * 10;

  const winner = aScore >= bScore ? a : b;
  const loser = winner === a ? b : a;

  const diff = Math.abs(aScore - bScore);
  let method: WinMethod = "decision";

  if (diff > 15) method = "pin";
  else if (diff > 10) method = "tech fall";
  else if (diff > 6) method = "major";

  const summary = `${winner.name} defeats ${loser.name} by ${method}.`;

  winner.form = Math.min(2, (winner.form || 0) + 1);
  winner.formDays = 5;
  loser.form = Math.max(-2, (loser.form || 0) - 1);
  loser.formDays = 5;

  return { winner, loser, method, summary };
}

function overallScore(w: Wrestler): number {
  return (
    w.neutral * 0.25 +
    w.top * 0.2 +
    w.bottom * 0.2 +
    w.technique * 0.2 +
    w.strength * 0.1 +
    w.conditioning * 0.05
  );
}
