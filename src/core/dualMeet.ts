// Dual meet simulation logic
import { WEIGHT_CLASSES } from "../data/weights";
import { simulateMatch, WinMethod, Wrestler } from "./match";

export interface Team {
  name: string;
  wrestlers: Wrestler[];
}

export interface BoutResult {
  weightClass: number;
  a?: Wrestler;
  b?: Wrestler;
  winnerSide: "A" | "B" | "none";
  method: WinMethod | "forfeit";
  summary: string;
}

export interface DualResult {
  log: string;
  scoreA: number;
  scoreB: number;
  bouts: BoutResult[];
}

export function teamPointsForMethod(method: WinMethod | "forfeit"): number {
  switch (method) {
    case "pin":
    case "forfeit":
      return 6;
    case "tech fall":
      return 5;
    case "major":
      return 4;
    case "decision":
    default:
      return 3;
  }
}

interface DualOptions {
  weightClasses?: number[];
  matchSimulator?: typeof simulateMatch;
}

export function simulateDual(teamA: Team, teamB: Team, options: DualOptions = {}): DualResult {
  const weightClasses = options.weightClasses || WEIGHT_CLASSES;
  const matchSimulator = options.matchSimulator || simulateMatch;

  let scoreA = 0;
  let scoreB = 0;
  const lines: string[] = [];
  const bouts: BoutResult[] = [];

  lines.push(`${teamA.name} vs ${teamB.name}`);
  lines.push(`--------------------------------`);

  for (const wc of weightClasses) {
    const aW = teamA.wrestlers.find((w) => w.weightClass === wc);
    const bW = teamB.wrestlers.find((w) => w.weightClass === wc);

    if (!aW && !bW) continue;

    if (aW && !bW) {
      scoreA += 6;
      lines.push(`${wc}: ${teamA.name} wins by forfeit (6-0) - ${aW.name}`);
      bouts.push({
        weightClass: wc,
        a: aW,
        winnerSide: "A",
        method: "forfeit",
        summary: `${aW.name} wins by forfeit`,
      });
      continue;
    }

    if (!aW && bW) {
      scoreB += 6;
      lines.push(`${wc}: ${teamB.name} wins by forfeit (6-0) - ${bW.name}`);
      bouts.push({
        weightClass: wc,
        b: bW,
        winnerSide: "B",
        method: "forfeit",
        summary: `${bW.name} wins by forfeit`,
      });
      continue;
    }

    const { winner, method, summary } = matchSimulator(aW!, bW!);
    const pts = teamPointsForMethod(method);

    if (winner === aW) scoreA += pts;
    else scoreB += pts;

    const teamStr = winner === aW ? teamA.name : teamB.name;
    lines.push(`${wc}: ${summary} (${teamStr} +${pts})`);
    bouts.push({
      weightClass: wc,
      a: aW!,
      b: bW!,
      winnerSide: winner === aW ? "A" : "B",
      method,
      summary,
    });
  }

  lines.push(`--------------------------------`);
  lines.push(`Final Team Score: ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}`);

  return { log: lines.join("\n"), scoreA, scoreB, bouts };
}
