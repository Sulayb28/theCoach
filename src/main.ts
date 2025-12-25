// ---- Types ----

import { simulateDual, teamPointsForMethod } from "./core/dualMeet";
import { simulateMatch } from "./core/match";
import type { WinMethod } from "./core/match";
import { createId, pickRandom, randomDelta } from "./core/rng";
import { WEIGHT_CLASSES } from "./data/weights";
import { SCHOOL_NAMES } from "./schools";
import { saveState, loadState } from "./store/storage";
import type { SavedState } from "./store/storage";
import { logToElement } from "./ui/logger";
import { buildLineupCard, ensureLineupSelections, renderRosterList } from "./ui/rosterUI";

interface Wrestler {
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
  morale?: number; // 0-100
  health?: number; // 0-100
  fatigue?: number; // 0-100
  classYear?: "FR" | "SO" | "JR" | "SR";
  potential?: number;
  injury?: { type: "minor" | "moderate" | "major"; days: number };
  form?: number; // -2 cold to +2 hot
  formDays?: number;
}


interface Team {

  name: string;

  wrestlers: Wrestler[];

}



interface Program {
  id: string;
  name: string;
  prestige: number;
  colors: [string, string];
  blurb: string;
  wrestlingPopularity: number; // 1-10 scale: how much the community cares
  athletics: number; // 1-10 overall athletic budget/resources
}

interface Prospect {
  id: string;
  name: string;
  weightClass: number;
  rating: number;
  interest: number; // 0-100
  rank: number;
  tags: string[];
  committed?: boolean;
  classYear?: number;
  potential?: number;
}

interface BoutResult {
  weightClass: number;
  a?: Wrestler;
  b?: Wrestler;
  winnerSide: "A" | "B" | "none";
  method: WinMethod | "forfeit";
  summary: string;
}

interface GazetteStory {
  type:
    | "team_upset"
    | "individual_upset"
    | "blowout"
    | "clutch_match"
    | "injury"
    | "star_dominated"
    | "default";
  importance: number;
  headline: string;
  blurb: string;
  tags?: string[];
}

interface GazettePayload {
  stories: GazetteStory[];
  scoreA: number;
  scoreB: number;
  myTeam: Team;
  opponent: Team;
  outcome: "WIN" | "LOSS" | "TIE";
  label: string;
  isPostseason?: boolean;
}

interface ReactionOption {
  id: string;
  label: string;
  apply: () => string;
}

interface LiveBoutState {
  weightClass: number;
  a?: Wrestler;
  b?: Wrestler;
  result?: BoutResult;
}

interface CoachingModifier {
  type: "push" | "solid";
  remaining: number;
}

interface LiveDualState {
  active: boolean;
  myTeam: Team;
  opponent: Team;
  bouts: LiveBoutState[];
  currentIndex: number;
  scoreA: number;
  scoreB: number;
  strategy: "balanced" | "aggressive" | "conservative";
  modifiers: CoachingModifier[];
  isPostseason?: boolean;
  scheduledWeek?: number;
  trainingNote?: string;
}

type TrainingFocus =
  | "balanced"
  | "neutral"
  | "top"
  | "bottom"

  | "strength"

  | "conditioning"

  | "technique";





interface DualResult {
  log: string;
  scoreA: number;
  scoreB: number;
  bouts: BoutResult[];
}

interface TournamentMatch {
  round: "Quarterfinal" | "Semifinal" | "Final";
  a: Wrestler;
  b: Wrestler;
  result: { winner: Wrestler; loser: Wrestler; method: WinMethod; summary: string };
}

interface WeightBracket {
  weightClass: number;
  quarterfinals: TournamentMatch[];
  semifinals: TournamentMatch[];
  final: TournamentMatch | null;
  champion?: string;
}

interface TournamentBracket {
  weights: WeightBracket[];
  placings: { weightClass: number; champion?: string; runnerUp?: string }[];
}

interface ScheduleEvent {
  week: number;
  opponent: Team;
  opponentProgramId?: string;
  isTournament?: boolean;
  result?: DualResult;
}

interface LeagueTeam {
  id?: string;
  name: string;
  wins: number;
  ties?: number;
  losses: number;
  pf: number;
  pa: number;
  rating: number;
  prestige?: number;
  lastResult?: string;
}


function addWeeklySummary(entry: string): void {
  weeklySummaries.unshift(entry);
  if (weeklySummaries.length > 10) weeklySummaries.pop();
  renderWeeklySummaries();
}

function renderWeeklySummaries(): void {
  if (weeklySummaryList) {
    weeklySummaryList.innerHTML = "";
    for (const s of weeklySummaries) {
      const li = document.createElement("li");
      li.textContent = s;
      weeklySummaryList.appendChild(li);
    }
  }
  if (postseasonLogDiv) {
    postseasonLogDiv.textContent = postseasonLog || "No postseason played yet.";
  }
  if (dualTeamLeft) dualTeamLeft.textContent = teamName || "Home";
  if (dualTeamRight) {
    const upcoming = schedule.find((e) => !e.result);
    dualTeamRight.textContent = upcoming?.opponent.name ?? "Opponent";
  }
  if (dualDayLabel) {
    const dayName = dayOfWeek === dualDay ? "Wednesday" : dayOfWeek === tournamentDay ? "Saturday" : `Day ${dayOfWeek}`;
    dualDayLabel.textContent = dayName;
  }
  if (homeDayLabel) {
    const dayName = dayOfWeek === dualDay ? "Wednesday (Dual)" : dayOfWeek === tournamentDay ? "Saturday (Tournament)" : `Day ${dayOfWeek}`;
    homeDayLabel.textContent = dayName;
  }
  if (homeTeamNameEl) homeTeamNameEl.textContent = teamName || "Your School";
}

function sortLeagueTeams(): LeagueTeam[] {
  return [...league].sort((a, b) => {
    const winPctA = a.wins + a.losses + (a.ties ?? 0) === 0 ? 0 : a.wins / (a.wins + a.losses + (a.ties ?? 0));
    const winPctB = b.wins + b.losses + (b.ties ?? 0) === 0 ? 0 : b.wins / (b.wins + b.losses + (b.ties ?? 0));
    if (winPctA !== winPctB) return winPctB - winPctA;
    const diffA = a.pf - a.pa;
    const diffB = b.pf - b.pa;
    if (diffA !== diffB) return diffB - diffA;
    return b.rating - a.rating;
  });
}

function setActiveView(viewKey: string): void {
  for (const btn of navButtons) {
    btn.classList.toggle("active", btn.dataset.view === viewKey);
  }
  for (const v of views) {
    v.classList.toggle("active", v.id === `view-${viewKey}`);
  }
  if (viewKey === "home") refreshLatestSummary();
  if (viewKey === "results") renderTournamentIfAvailable();
  if (viewKey === "rankings") renderRankingTable();
}

function ensureGazetteOverlay(): void {
  if (gazetteOverlay) return;
  const style = document.createElement("style");
  style.textContent = `
    #gazette-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 12px;
      z-index: 999;
    }
    #gazette-overlay.active { display: flex; }
    .gazette-card {
      background: #f8f5ef;
      color: #111;
      width: min(720px, 100%);
      max-height: 90vh;
      overflow-y: auto;
      padding: 16px;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-family: "Georgia", serif;
    }
    .gazette-banner { text-align: center; font-weight: 700; letter-spacing: 1px; font-size: 1rem; }
    .gazette-headline { font-size: 1.4rem; margin: 0; }
    .gazette-subhead { font-size: 0.95rem; margin: 0; color: #333; }
    .gazette-score { font-weight: 600; font-size: 1rem; }
    .gazette-secondary { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
    .gazette-secondary li { border-top: 1px solid #ddd; padding-top: 6px; }
    .gazette-label { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.6px; color: #555; }
    .gazette-actions { display: flex; flex-direction: column; gap: 6px; }
    .gazette-actions button { padding: 10px; font-size: 0.95rem; border-radius: 6px; border: 1px solid #222; background: #fff; }
    .gazette-footer { display: flex; gap: 8px; flex-wrap: wrap; }
    .gazette-footer button { flex: 1 1 140px; padding: 10px; border-radius: 6px; border: none; font-weight: 600; }
  `;
  document.head.appendChild(style);

  gazetteOverlay = document.createElement("div");
  gazetteOverlay.id = "gazette-overlay";
  gazetteOverlay.innerHTML = `
    <div class="gazette-card">
      <div class="gazette-banner" id="gazette-title"></div>
      <span class="gazette-label" id="gazette-label"></span>
      <h2 class="gazette-headline" id="gazette-headline"></h2>
      <div class="gazette-score" id="gazette-score"></div>
      <p class="gazette-subhead" id="gazette-blurb"></p>
      <ul class="gazette-secondary" id="gazette-secondary"></ul>
      <div class="gazette-actions" id="gazette-reactions"></div>
      <div id="gazette-feedback" class="meta"></div>
      <div class="gazette-footer">
        <button id="gazette-continue">Continue</button>
        <button id="gazette-box">View Box Score</button>
      </div>
    </div>
  `;
  document.body.appendChild(gazetteOverlay);
  gazetteHeadlineEl = document.getElementById("gazette-headline") as HTMLHeadingElement;
  gazetteBlurbEl = document.getElementById("gazette-blurb") as HTMLParagraphElement;
  gazetteScoreEl = document.getElementById("gazette-score") as HTMLDivElement;
  gazetteSecondaryEl = document.getElementById("gazette-secondary") as HTMLUListElement;
  gazetteLabelEl = document.getElementById("gazette-label") as HTMLSpanElement;
  gazetteReactionEl = document.getElementById("gazette-reactions") as HTMLDivElement;
  gazetteFeedbackEl = document.getElementById("gazette-feedback") as HTMLDivElement;
  gazetteContinueBtn = document.getElementById("gazette-continue") as HTMLButtonElement;
  gazetteBoxBtn = document.getElementById("gazette-box") as HTMLButtonElement;
}

function ensureLiveDualUI(): void {
  if (liveDualView) return;
  liveDualView = document.createElement("div");
  liveDualView.id = "view-live-dual";
  liveDualView.className = "view";
  liveDualView.innerHTML = `
    <div class="panel">
      <h2 id="live-title">Live Dual</h2>
      <div id="live-score" class="meta"></div>
      <div id="live-strategy" class="meta"></div>
    </div>
    <div class="panel" id="live-bout-card">No bout yet.</div>
    <div class="panel" id="live-buttons"></div>
    <div class="panel">
      <button id="live-start-btn" class="primary-btn">Start Dual</button>
    </div>
  `;
  const host = document.getElementById("game-ui") || document.body;
  host.appendChild(liveDualView);
  views.push(liveDualView);
  liveTitleEl = document.getElementById("live-title");
  liveScoreEl = document.getElementById("live-score");
  liveBoutEl = document.getElementById("live-bout-card");
  liveButtonsEl = document.getElementById("live-buttons");
  liveStartBtn = document.getElementById("live-start-btn") as HTMLButtonElement;
  liveStrategyEl = document.getElementById("live-strategy");
  if (liveStartBtn) {
    liveStartBtn.addEventListener("click", () => {
      if (!liveDualState) return;
      advanceLiveBout();
    });
  }
}

function computeOutcomeLabel(payload: GazettePayload): string {
  const margin = Math.abs(payload.scoreA - payload.scoreB);
  const upset = payload.stories.find((s) => s.type === "team_upset");
  if (payload.outcome === "WIN" && upset) return "Upset Win";
  if (payload.outcome === "WIN" && margin >= 12) return "Statement Victory";
  if (payload.outcome === "WIN" && margin <= 3) return "Edge-Out Win";
  if (payload.outcome === "LOSS" && margin >= 12) return "Tough Loss";
  if (payload.outcome === "LOSS" && margin <= 3) return "Close Loss";
  return payload.outcome === "TIE" ? "Split Points" : payload.outcome === "WIN" ? "Solid Win" : "Loss";
}

function buildCoachReactions(payload: GazettePayload): ReactionOption[] {
  const margin = Math.abs(payload.scoreA - payload.scoreB);
  const upset = payload.stories.some((s) => s.type === "team_upset");
  const starters = getStarters();
  const reactions: ReactionOption[] = [];

  const boostMorale = (delta: number) => {
    for (const w of roster) {
      w.morale = clampStat((w.morale || 70) + delta);
    }
  };
  const tweakFormStarters = (delta: number) => {
    for (const w of starters) {
      w.form = Math.max(-2, Math.min(2, (w.form || 0) + delta));
      w.formDays = Math.max(w.formDays || 0, 4);
    }
  };
  const tweakFatigueStarters = (delta: number) => {
    for (const w of starters) {
      w.fatigue = Math.max(0, Math.min(100, (w.fatigue || 0) + delta));
    }
  };

  if (payload.outcome === "WIN") {
    reactions.push({
      id: "praise",
      label: "Praise the team (morale up)",
      apply: () => {
        boostMorale(4);
        tweakFormStarters(1);
        return "You praised the team. Morale rises across the room.";
      },
    });
    reactions.push({
      id: "humble",
      label: "Stay humble (small morale + prestige)",
      apply: () => {
        boostMorale(2);
        if (currentProgram) currentProgram.prestige = clampStat((currentProgram.prestige || 80) + 1);
        return "You kept the team grounded. Prestige bumps slightly.";
      },
    });
    reactions.push({
      id: "focus",
      label: "Focus on next week (form up, rest starters)",
      apply: () => {
        tweakFormStarters(1);
        tweakFatigueStarters(-5);
        return "Starters reset focus. Fatigue eases a bit.";
      },
    });
    if (upset) reactions[0].label = "Celebrate the upset (big morale boost)";
  } else {
    reactions.push({
      id: "meeting",
      label: "Team meeting (steady morale)",
      apply: () => {
        for (const w of roster) {
          w.morale = clampStat(((w.morale || 70) * 0.8 + 70 * 0.2));
          if ((w.form || 0) < 0) w.form = Math.min(0, (w.form || 0) + 1);
        }
        return "You held a meeting. Morale normalizes.";
      },
    });
    reactions.push({
      id: "hard-practice",
      label: "Hard practice (fatigue up, small development)",
      apply: () => {
        for (const w of starters) {
          w.fatigue = Math.min(100, (w.fatigue || 0) + 6);
          w.conditioning = clampStat(w.conditioning + 1);
          w.technique = clampStat(w.technique + 1);
        }
        return "Extra drills scheduled. Conditioning and technique rise slightly.";
      },
    });
    reactions.push({
      id: "reset",
      label: "Let it go (no change)",
      apply: () => "You chose to move on quickly.",
    });
    if (margin <= 3) reactions[0].label = "Close loss chat (morale steady)";
  }

  return reactions.slice(0, 3);
}

function renderGazette(payload: GazettePayload): void {
  ensureGazetteOverlay();
  if (!gazetteOverlay || !gazetteHeadlineEl || !gazetteBlurbEl || !gazetteScoreEl || !gazetteSecondaryEl || !gazetteLabelEl || !gazetteReactionEl || !gazetteFeedbackEl || !gazetteContinueBtn || !gazetteBoxBtn) return;

  gazetteReactionChosen = false;

  const titleEl = document.getElementById("gazette-title") as HTMLDivElement | null;
  if (titleEl) {
    const weekLabel = Math.max(1, seasonWeek - 1);
    titleEl.textContent = `WRESTLING GAZETTE - Week ${weekLabel}`;
  }

  const main = payload.stories[0];
  gazetteHeadlineEl.textContent = main.headline;
  gazetteBlurbEl.textContent = main.blurb;
  gazetteScoreEl.textContent = `Final: ${payload.myTeam.name} ${payload.scoreA} - ${payload.scoreB} ${payload.opponent.name}`;
  gazetteLabelEl.textContent = payload.label || computeOutcomeLabel(payload);

  gazetteSecondaryEl!.innerHTML = "";
  payload.stories.slice(1, 5).forEach((s) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${s.headline}</strong><div class="meta">${s.blurb}</div>`;
    gazetteSecondaryEl!.appendChild(li);
  });

  gazetteFeedbackEl!.textContent = "";
  gazetteReactionEl!.innerHTML = "";
  const reactions = buildCoachReactions(payload);
  reactions.forEach((opt) => {
    const btn = document.createElement("button");
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      if (gazetteReactionChosen) return;
      gazetteReactionChosen = true;
      const feedback = opt.apply();
      gazetteFeedbackEl!.textContent = feedback;
      Array.from(gazetteReactionEl!.querySelectorAll("button")).forEach((b) => ((b as HTMLButtonElement).disabled = true));
      refreshRosterUI();
      renderStandings();
      saveRoster();
    });
    gazetteReactionEl!.appendChild(btn);
  });

  gazetteContinueBtn.onclick = () => {
    gazetteOverlay!.classList.remove("active");
    setActiveView("home");
  };
  gazetteBoxBtn.onclick = () => {
    gazetteOverlay!.classList.remove("active");
    setActiveView("duals");
  };

  gazetteOverlay.classList.add("active");
}
function renderStandings(): void {
  const sorted = sortLeagueTeams();
  if (standingsList) {
    standingsList.innerHTML = "";
    for (const team of sorted) {
      const diff = team.pf - team.pa;
      const winPct = team.wins + team.losses + (team.ties ?? 0) === 0 ? 0 : (team.wins / (team.wins + team.losses + (team.ties ?? 0))) * 100;
      const li = document.createElement("li");
      if (team.name === teamName) li.classList.add("highlight");
      const prestigeStr = team.prestige ? ` | Prestige ${team.prestige}` : "";
      const ties = team.ties ?? 0;
      const record = ties > 0 ? `${team.wins}-${ties}-${team.losses}` : `${team.wins}-${team.losses}`;
      li.innerHTML = `<div><strong>${team.name}</strong> <span class="meta record">${record} (${winPct.toFixed(0)}%)</span></div><div class="meta">PF ${team.pf} | PA ${team.pa} | Diff ${diff} | Rating ${team.rating.toFixed(0)}${prestigeStr}${team.lastResult ? ` | ${team.lastResult}` : ""}</div>`;
      standingsList.appendChild(li);
    }
  }

  // Home tile rankings based on standings position
  const myRank = sorted.findIndex((t) => t.name === teamName) + 1;
  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  if (tileDistrict) tileDistrict.textContent = myRank ? ordinal(myRank) : "--";
  if (tileRegional) tileRegional.textContent = myRank ? ordinal(Math.max(1, myRank * 2)) : "--";
  if (tileState) tileState.textContent = myRank ? ordinal(Math.max(1, myRank * 4)) : "--";

  renderRankingTable();
}

function getScopedStandings(scope: RankingScope): { team: LeagueTeam; rank: number; points: number; wins: number; ties: number; losses: number }[] {
  const sorted = sortLeagueTeams();
  return sorted.map((team, idx) => {
    const baseRank = idx + 1;
    const scopeRank = scope === "district" ? baseRank : scope === "regional" ? baseRank * 2 : baseRank * 4;
    return {
      team,
      rank: scopeRank,
      wins: team.wins,
      ties: team.ties ?? 0,
      losses: team.losses,
      points: Math.max(0, team.pf),
    };
  });
}

function renderRankingTable(): void {
  if (!rankingTableBody) return;
  const rows = getScopedStandings(rankingScope);
  const filtered = rankingFilter ? rows.filter((r) => r.team.name.toLowerCase().includes(rankingFilter.toLowerCase())) : rows;

  const sorted = [...filtered].sort((a, b) => {
    const direction = rankingSort.direction === "asc" ? 1 : -1;
    if (rankingSort.key === "name") {
      return a.team.name.localeCompare(b.team.name) * direction;
    }
    const valueFor = (r: (typeof rows)[number]) => {
      switch (rankingSort.key) {
        case "rank":
          return r.rank;
        case "wins":
          return r.wins;
        case "ties":
          return r.ties;
        case "losses":
          return r.losses;
        case "rating":
          return r.team.rating;
        case "points":
          return r.points;
        default:
          return r.rank;
      }
    };
    const valA = valueFor(a);
    const valB = valueFor(b);
    if (valA === valB) return a.rank - b.rank;
    return (valA - valB) * direction;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / RANKING_PAGE_SIZE));
  if (rankingPage > totalPages) rankingPage = totalPages;
  const startIdx = (rankingPage - 1) * RANKING_PAGE_SIZE;
  const pageRows = sorted.slice(startIdx, startIdx + RANKING_PAGE_SIZE);

  rankingTableBody.innerHTML = "";
  if (pageRows.length === 0) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 7;
    emptyCell.textContent = rankingFilter ? "No schools match that search." : "No teams available yet.";
    emptyRow.appendChild(emptyCell);
    rankingTableBody.appendChild(emptyRow);
  } else {
    for (const row of pageRows) {
      const tr = document.createElement("tr");
      if (row.team.name === teamName) tr.classList.add("highlight");
      if (rankingFilter && row.team.name.toLowerCase().includes(rankingFilter.toLowerCase())) tr.classList.add("search-match");
      const record = row.ties > 0 ? `${row.wins}-${row.ties}-${row.losses}` : `${row.wins}-${row.losses}`;
      tr.innerHTML = `
        <td>${row.rank}</td>
        <td>${row.team.name}</td>
        <td>${row.wins}</td>
        <td>${row.ties}</td>
        <td>${row.losses}</td>
        <td>${row.team.rating.toFixed(0)}</td>
        <td>${row.points.toFixed(0)}<div class="meta">Record ${record}</div></td>
      `;
      rankingTableBody.appendChild(tr);
    }
  }

  if (rankingPageInfo) rankingPageInfo.textContent = `Page ${rankingPage} of ${totalPages}`;
  if (rankingPrevBtn) rankingPrevBtn.disabled = rankingPage <= 1;
  if (rankingNextBtn) rankingNextBtn.disabled = rankingPage >= totalPages;

  rankingHeaders.forEach((h) => {
    const sortKey = h.dataset.sort as RankingSortKey | undefined;
    h.classList.toggle("sorted", sortKey === rankingSort.key);
    h.classList.toggle("desc", sortKey === rankingSort.key && rankingSort.direction === "desc");
  });
}





// ---- State & constants ----

const roster: Wrestler[] = [];
let teamName = "My Team";
let currentProgram: Program | null = null;

let dayOfWeek = 1;
let seasonWeek = 1;
let seasonWins = 0;
let seasonLosses = 0;

const lineupSelections: Record<number, string | null> = {};
const recruits: Prospect[] = [];
const shortlist: Prospect[] = [];
const schedule: ScheduleEvent[] = [];
let nextOpponent: Team | null = null;

let budget = 50; // 0-100
let nilBudget = 50; // 0-100
let committedThisSeason = 0;
const weeklySummaries: string[] = [];
let league: LeagueTeam[] = [];
let postseasonLog = "";
let postseasonBracket: { semifinal1?: DualResult; semifinal2?: DualResult; final?: DualResult } = {};
const signedRecruits: Prospect[] = [];
let strategy: "balanced" | "aggressive" | "conservative" = "balanced";
let allowBump = false;
let postseasonPlayed = false;
let dualDay = 3; // Wednesday (1=Mon)
let tournamentDay = 6; // Saturday
const OFFSEASON_DEV_BONUS = 3;
let gazetteReactionChosen = false;
let liveDualState: LiveDualState | null = null;
let lastTournamentBracket: TournamentBracket | null = null;
let latestResultSummary = "";
let offseasonRecap = "";
type RankingScope = "district" | "regional" | "state";
type RankingSortKey = "rank" | "name" | "wins" | "ties" | "losses" | "rating" | "points";
let rankingScope: RankingScope = "district";
let rankingSort: { key: RankingSortKey; direction: "asc" | "desc" } = { key: "rank", direction: "asc" };
let rankingFilter = "";
let rankingPage = 1;
const RANKING_PAGE_SIZE = 10;
const TRAINING_EFFECTS: Record<TrainingFocus, string> = {
  balanced: "+neutral/top/bottom/technique (small) | -fatigue",
  neutral: "+neutral/technique | -fatigue",
  top: "+top/technique | -fatigue",
  bottom: "+bottom/technique | -fatigue",
  strength: "+strength | -neutral/top/bottom (minor) | -fatigue",
  conditioning: "+conditioning | -fatigue",
  technique: "+technique | -fatigue",
};

const STORAGE_KEY = "wcg:save:v2";
const LEGACY_STORAGE_KEY = "wcg:roster:v1";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function initLeague(): void {
  league = PROGRAMS.map((p) => ({
    id: p.id,
    name: p.name,
    wins: 0,
    ties: 0,
    losses: 0,
    pf: 0,
    pa: 0,
    rating: p.prestige * 10,
    prestige: p.prestige,
  }));
  postseasonPlayed = false;
}




const COLOR_PALETTE: [string, string][] = [
  ["#12355b", "#c4a000"],
  ["#0b3d2e", "#20c997"],
  ["#5d120a", "#eab308"],
  ["#0b1b35", "#67e8f9"],
  ["#6b2f14", "#f59e0b"],
  ["#111827", "#9ca3af"],
  ["#0f172a", "#22c55e"],
  ["#581c87", "#c084fc"],
  ["#1f2937", "#34d399"],
  ["#0ea5e9", "#f59e0b"],
  ["#7c2d12", "#f97316"],
  ["#0f172a", "#a855f7"],
];

const PROGRAMS: Program[] = SCHOOL_NAMES.map((name, idx) => {
  const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];
  const prestige = 70 + (idx % 20);
  const wrestlingPopularity = 6 + (idx % 5);
  const athletics = 5 + (idx % 5);
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    prestige,
    colors: color,
    blurb: "High school program with growing tradition.",
    wrestlingPopularity,
    athletics,
  };
});


const FIRST_NAMES = [

  "Logan",

  "Carter",

  "Ethan",

  "Griffin",

  "Noah",

  "Owen",

  "Jack",

  "Wyatt",

  "Mason",

  "Caleb",

  "Colton",

  "Hudson",

  "Chase",

  "Liam",

  "Miles",

];



const LAST_NAMES = [
  "Brooks",
  "Hall",
  "Ramos",
  "Starocci",
  "Lee",

  "Carr",

  "Parco",

  "Gable",

  "Brooks",

  "Sloan",

  "Fix",

  "Bravo-Young",

  "O'Toole",

  "Haines",
  "Shane",
];

const PROSPECT_TAGS = [
  "Scrambler",
  "Gas Tank",
  "Top Rider",
  "Turns",
  "Funk",
  "Hammer",
  "Raw Athlete",
  "Coach's Favorite",
];

const CLASS_YEARS: Array<"FR" | "SO" | "JR" | "SR"> = ["FR", "SO", "JR", "SR"];

// ---- Helpers ----
function getWeightClass(weight: number): number {

  let closest = WEIGHT_CLASSES[0];

  let bestDiff = Math.abs(weight - closest);

  for (const wc of WEIGHT_CLASSES) {

    const diff = Math.abs(weight - wc);

    if (diff < bestDiff) {

      bestDiff = diff;

      closest = wc;

    }

  }

  return closest;

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



function clampStat(v: number): number {
  if (Number.isNaN(v)) return 50;
  return Math.min(99, Math.max(1, v));
}

function refreshLatestSummary(): void {
  if (latestResultEl) {
    latestResultEl.textContent = latestResultSummary || "No results yet.";
  }
  if (nextOpponentEl) {
    const upcoming = schedule.find((e) => !e.result);
    nextOpponentEl.textContent = upcoming
      ? `${upcoming.opponent.name} (Week ${upcoming.week}${upcoming.isTournament ? " - Tournament" : ""})`
      : "Season complete";
  }
}

function renderOffseasonRecap(): void {
  if (offseasonRecapEl) {
    offseasonRecapEl.textContent = offseasonRecap || "Finish the season to see a recap.";
  }
}

function refreshTrainingEffects(): void {
  if (!trainingEffectsEl) return;
  const focus = (trainingSelect?.value as TrainingFocus) || "balanced";
  const budgetFactor = budget >= 70 ? "Low fatigue loss" : budget <= 30 ? "Higher fatigue loss" : "Moderate fatigue";
  const nilFactor = nilBudget >= 70 ? "Recruiting boosted" : nilBudget <= 30 ? "Recruiting slow" : "Recruiting steady";
  trainingEffectsEl.textContent = `${TRAINING_EFFECTS[focus]} | ${budgetFactor} | ${nilFactor}`;
}

function isMajorInjury(w: Wrestler | undefined): boolean {
  return !!(w && w.injury && w.injury.type === "major" && w.injury.days > 0);
}

function bestCandidateForWeight(weightClass: number): Wrestler | undefined {
  return roster
    .filter((w) => w.weightClass === weightClass)
    .sort((a, b) => overallScore(b) - overallScore(a))[0];
}

function autoFillLineupIfEmpty(): void {
  let changed = false;
  for (const wc of WEIGHT_CLASSES) {
    if (!lineupSelections[wc]) {
      const best = bestCandidateForWeight(wc);
      lineupSelections[wc] = best ? best.id : null;
      changed = true;
    }
  }
  if (changed) {
    refreshRosterUI();
    logToElement(resultLog, "Lineup auto-filled with best available wrestlers.");
  }
}

function ensureLineupReady(): boolean {
  const missing: number[] = [];
  const used = new Set<string>();
  for (const wc of WEIGHT_CLASSES) {
    let chosenId = lineupSelections[wc];
    let chosen = chosenId ? roster.find((w) => w.id === chosenId) : undefined;
    if (chosen && isMajorInjury(chosen)) chosen = undefined;

    if (chosen && !used.has(chosen.id)) {
      used.add(chosen.id);
      continue;
    }

    const same = roster.find((w) => w.weightClass === wc && !isMajorInjury(w) && !used.has(w.id));
    if (same) {
      lineupSelections[wc] = same.id;
      used.add(same.id);
      continue;
    }

    if (allowBump) {
      const idx = WEIGHT_CLASSES.indexOf(wc);
      const lowerWc = idx > 0 ? WEIGHT_CLASSES[idx - 1] : null;
      if (lowerWc) {
        const bump = roster.find((w) => w.weightClass === lowerWc && !isMajorInjury(w) && !used.has(w.id));
        if (bump) {
          lineupSelections[wc] = bump.id;
          used.add(bump.id);
          continue;
        }
      }
    }

    missing.push(wc);
  }

  if (missing.length > 0) {
    refreshRosterUI(missing);
    const msg = `Lineup incomplete: no healthy starter or bump at ${missing.join(", ")} lbs.`;
    if (seasonLog) seasonLog.textContent = msg;
    logToElement(resultLog, msg);
    return false;
  }

  refreshRosterUI();
  return true;
}

function prestigeBase(program: Program): number {
  // Combine prestige with athletics and wrestling popularity to bias baseline stats.
  const { prestige, athletics, wrestlingPopularity } = program;
  const prestigeComponent = (prestige - 70) * 0.35;
  const athleticsComponent = (athletics - 5) * 1.2;
  const wrestlingComponent = (wrestlingPopularity - 5) * 1.4;
  return 55 + prestigeComponent + athleticsComponent + wrestlingComponent;
}

function randomStat(program: Program): number {
  const base = prestigeBase(program);
  const variance = 8;
  const delta = Math.floor(Math.random() * (variance * 2 + 1)) - variance;
  return clampStat(Math.round(base + delta));
}

function generateWrestler(program: Program, weightClass: number): Wrestler {
  const weight = weightClass + Math.floor(Math.random() * 7) - 3; // +- 3 lbs |variance
  const classYear = pickRandom(CLASS_YEARS);
  const potential = clampStat(prestigeBase(program) + Math.floor(Math.random() * 12) - 6);
  return {
    id: createId(),
    name: `${pickRandom(FIRST_NAMES)} ${pickRandom(LAST_NAMES)}`,
    weight,
    weightClass,
    neutral: randomStat(program),
    top: randomStat(program),
    bottom: randomStat(program),
    strength: randomStat(program),
    conditioning: randomStat(program),
    technique: randomStat(program),
    classYear,
    potential,
  };
}

function generateRosterForProgram(program: Program): void {
  roster.length = 0;
  for (const wc of WEIGHT_CLASSES) {
    const depthScore = (program.athletics + program.wrestlingPopularity) / 2;
    const openChance = depthScore < 5 ? 0.3 : depthScore < 7 ? 0.15 : 0.05;
    if (Math.random() < openChance) {
      continue; // leave weight open
    }
    const w = generateWrestler(program, wc);
    w.morale = 70 + Math.floor(Math.random() * 10);
    w.health = 90 + Math.floor(Math.random() * 10);
    w.fatigue = 20 + Math.floor(Math.random() * 10);
    roster.push(w);
  }
  ensureLineupSelections(lineupSelections, roster, WEIGHT_CLASSES);
  refreshRosterUI();
  resultLog.textContent = `${program.name} roster generated.`;
}

function randomProspect(program: Program): Prospect {
  const wc = pickRandom(WEIGHT_CLASSES);
  const rating = clampStat(Math.round(prestigeBase(program) + Math.random() * 8 - 4));
  const interestBase =
    40 +
    (program.prestige - 70) * 0.6 +
    (program.wrestlingPopularity - 5) * 4 +
    (program.athletics - 5) * 3 +
    (Math.random() * 10 - 5);
  const interest = Math.max(15, Math.min(100, Math.round(interestBase)));
  const potential = clampStat(rating + Math.floor(Math.random() * 10) - 3);
  return {
    id: createId(),
    name: `${pickRandom(FIRST_NAMES)} ${pickRandom(LAST_NAMES)}`,
    weightClass: wc,
    rating,
    interest,
    rank: 0,
    tags: [pickRandom(PROSPECT_TAGS)],
    potential,
  };
}

function generateProspects(program?: Program, count = 12): void {
  const p = program || currentProgram;
  if (!p) return;
  recruits.length = 0;
  for (let i = 0; i < count; i++) {
    recruits.push(randomProspect(p));
  }
  recruits.sort((a, b) => b.rating - a.rating);
  recruits.forEach((r, idx) => (r.rank = idx + 1));
  renderRecruitLists();
}

function renderRecruitLists(): void {
  if (recruitList) {
    recruitList.innerHTML = "";
    for (const r of recruits) {
      const li = document.createElement("li");
      li.innerHTML = `<div><strong>${r.name}</strong> <span class="meta">${r.weightClass} lbs | OVR ${r.rating} | Interest ${r.interest}</span></div>`;
      const btn = document.createElement("button");
      btn.textContent = "Shortlist";
      btn.addEventListener("click", () => addToShortlist(r.id));
      li.appendChild(btn);
      recruitList.appendChild(li);
    }
  }

  if (shortlistList) {
    shortlistList.innerHTML = "";
    for (const r of shortlist) {
      const li = document.createElement("li");
      li.innerHTML = `<div><strong>${r.name}</strong> <span class="meta">${r.weightClass} lbs | OVR ${r.rating} | Interest ${r.interest}</span></div>`;
      const actions = document.createElement("div");
      const pitch = document.createElement("button");
      pitch.textContent = "Pitch";
      pitch.addEventListener("click", () => pitchProspect(r.id));
      const offer = document.createElement("button");
      offer.textContent = "Offer";
      offer.addEventListener("click", () => offerProspect(r.id));
      const remove = document.createElement("button");
      remove.textContent = "Remove";
      remove.addEventListener("click", () => removeFromShortlist(r.id));
      actions.appendChild(pitch);
      actions.appendChild(offer);
      actions.appendChild(remove);
      li.appendChild(actions);
      shortlistList.appendChild(li);
    }
  }
}

function addToShortlist(id: string): void {
  const existing = shortlist.find((p) => p.id === id);
  if (existing) return;
  const found = recruits.find((p) => p.id === id);
  if (found) {
    shortlist.push(found);
    renderRecruitLists();
  }
}

function removeFromShortlist(id: string): void {
  const idx = shortlist.findIndex((p) => p.id === id);
  if (idx >= 0) {
    shortlist.splice(idx, 1);
    renderRecruitLists();
  }
}

function pitchProspect(id: string): void {
  const target = shortlist.find((p) => p.id === id);
  if (!target) return;
  const boost = 8 + Math.floor(nilBudget / 25);
  target.interest = Math.min(100, target.interest + boost);
  renderRecruitLists();
}

function offerProspect(id: string): void {
  const target = shortlist.find((p) => p.id === id);
  if (!target) return;
  if (target.interest < 70) {
    target.interest = Math.min(100, target.interest + 5);
    renderRecruitLists();
    return;
  }
  target.committed = true;
  signedRecruits.push(target);
  committedThisSeason += 1;
  removeFromShortlist(id);
  renderRecruitLists();
}

function tickRecruitInterest(decay = 1): void {
  const adjustedDecay = Math.max(0, decay - Math.floor(nilBudget / 40));
  const decayOne = (p: Prospect) => {
    p.interest = Math.max(0, p.interest - adjustedDecay);
  };
  recruits.forEach(decayOne);
  shortlist.forEach(decayOne);
  renderRecruitLists();
}

interface Goal {
  id: string;
  title: string;
  desc: string;
  target: number;
  progress: () => number;
}

const GOALS: Goal[] = [
  {
    id: "wins",
    title: "Win 5 duals",
    desc: "Reach 5 dual wins this season",
    target: 5,
    progress: () => seasonWins,
  },
  {
    id: "recruits",
    title: "Sign 2 recruits",
    desc: "Land two commitments this season",
    target: 2,
    progress: () => committedThisSeason,
  },
  {
    id: "morale",
    title: "Room morale 70+",
    desc: "Keep team average morale above 70",
    target: 70,
    progress: () => {
      if (roster.length === 0) return 0;
      const sum = roster.reduce((acc, w) => acc + (w.morale || 70), 0);
      return Math.round(sum / roster.length);
    },
  },
];

function renderGoals(): void {
  if (!goalsList) return;
  goalsList.innerHTML = "";
  for (const g of GOALS) {
    const value = g.progress();
    const done = value >= g.target;
    const li = document.createElement("li");
    li.innerHTML = `<div><strong>${g.title}</strong><span class="meta">${g.desc}</span></div><span class="meta">${value}/${g.target}${done ? ' done' : ''}</span>`;
    goalsList.appendChild(li);
  }
}



function simulateDualVsOpponent(): { result: DualResult; myTeam: Team; rival: Team } | null {
  if (roster.length === 0) {
    resultLog.textContent = "Add wrestlers first.";
    return null;
  }
  if (!ensureLineupReady()) return null;
  const myTeam = buildTeamFromRoster(roster, teamName || "My Team");
  const rival = generateOpponentTeam(myTeam, pickRandom(SCHOOL_NAMES));
  const result = simulateDual(myTeam, rival);
   updateLeague(myTeam.name, rival.name, result.scoreA, result.scoreB);
   renderStandings();
  return { result, myTeam, rival };
}


// ---- Program selection ----

function renderProgramSelect(): void {

  if (!programGrid) return;

  programGrid.innerHTML = "";

  for (const program of PROGRAMS) {

    const card = document.createElement("button");

    card.className = "program-card";

    card.type = "button";

    const [c1, c2] = program.colors;

    card.style.background = `linear-gradient(145deg, ${c1}, ${c2})`;

    card.innerHTML = `

      <div class="program-meta">

        <span class="program-badge">Prestige ${program.prestige}</span>

        <span>${program.name}</span>

      </div>

      <h3>${program.name}</h3>

      <p class="program-blurb">${program.blurb}</p>

    `;

    card.addEventListener("click", () => applyProgram(program));

    programGrid.appendChild(card);

  }

}



function applyProgram(program: Program, opts?: { keepTeamName?: boolean; skipRosterGeneration?: boolean }): void {
  currentProgram = program;
  const desiredName = opts?.keepTeamName && teamName ? teamName : program.name;
  teamName = desiredName;
  initLeague();
  liveDualState = null;
  if (teamNameInput) teamNameInput.value = teamName;
  if (programNameEl) programNameEl.textContent = program.name;
  if (programBlurbEl) programBlurbEl.textContent = program.blurb;
  if (programPrestigeEl) programPrestigeEl.textContent = String(program.prestige);


  if (programSelectSection) programSelectSection.classList.add("hidden");
  if (gameUI) gameUI.classList.remove("hidden");

  if (!opts?.skipRosterGeneration) {
    dayOfWeek = 1;
    seasonWeek = 1;
    seasonWins = 0;
    seasonLosses = 0;
    for (const key of Object.keys(lineupSelections)) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete lineupSelections[Number(key)];
    }
    generateRosterForProgram(program);
    generateProspects(program);
    generateSeasonSchedule();
    autoFillLineupIfEmpty();
    committedThisSeason = 0;
    weeklySummaries.length = 0;
  }

  updateSeasonUI();
  renderGoals();
  renderSchedule();
  renderRecruitLists();
  renderWeeklySummaries();
}


function resetProgramSelection(): void {
  currentProgram = null;
  teamName = "My Team";
  if (teamNameInput) teamNameInput.value = "";
  roster.length = 0;
  refreshRosterUI();
  dayOfWeek = 1;
  seasonWeek = 1;
  seasonWins = 0;
  seasonLosses = 0;
  committedThisSeason = 0;
  weeklySummaries.length = 0;
  updateSeasonUI();
  renderWeeklySummaries();
  if (programNameEl) programNameEl.textContent = "No Program Selected";
  if (programBlurbEl) programBlurbEl.textContent = "";
  if (programPrestigeEl) programPrestigeEl.textContent = "-";
  if (programSelectSection) programSelectSection.classList.remove("hidden");
  if (gameUI) gameUI.classList.add("hidden");

  if (resultLog) resultLog.textContent = "";

  if (dualLog) dualLog.textContent = "";

  if (vsOpponentLog) vsOpponentLog.textContent = "";

  if (seasonLog) seasonLog.textContent = "";

}



function ensureProgramSelected(): boolean {

  if (currentProgram) return true;

  if (resultLog) resultLog.textContent = "Select a program to start.";

  return false;

}





// ---- DOM Elements ----

const rosterList = document.getElementById("roster-list") as HTMLUListElement;
const selectA = document.getElementById("wrestler-a") as HTMLSelectElement;
const selectB = document.getElementById("wrestler-b") as HTMLSelectElement;
const simulateBtn = document.getElementById("simulate-btn") as HTMLButtonElement;
const resultLog = document.getElementById("result-log") as HTMLDivElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const loadBtn = document.getElementById("load-btn") as HTMLButtonElement;
const dualBtn = document.getElementById("dual-btn") as HTMLButtonElement;
const dualLog = document.getElementById("dual-log") as HTMLDivElement;
const teamNameInput = document.getElementById("team-name") as HTMLInputElement;
const vsOpponentBtn = document.getElementById("vs-opponent-btn") as HTMLButtonElement;
const vsOpponentLog = document.getElementById("vs-opponent-log") as HTMLDivElement;
const quickSimBtn = document.getElementById("quick-sim-btn") as HTMLButtonElement | null;
const seasonDaySpan = document.getElementById("season-day") as HTMLSpanElement;
const seasonWeekSpan = document.getElementById("season-week") as HTMLSpanElement;
const trainingSelect = document.getElementById("training-focus") as HTMLSelectElement;
const seasonRecordSpan = document.getElementById("season-record") as HTMLSpanElement;
const seasonNextBtn = document.getElementById("season-next-btn") as HTMLButtonElement;
const seasonLog = document.getElementById("season-log") as HTMLDivElement;
const regenRosterBtn = document.getElementById("regen-roster-btn") as HTMLButtonElement;
const lineupGrid = document.getElementById("lineup-grid") as HTMLDivElement;
const recruitList = document.getElementById("recruit-list") as HTMLUListElement;
const shortlistList = document.getElementById("shortlist") as HTMLUListElement;
const recruitGenerateBtn = document.getElementById("recruit-generate-btn") as HTMLButtonElement;
const recruitDecayBtn = document.getElementById("recruit-decay-btn") as HTMLButtonElement;
const budgetSlider = document.getElementById("budget-slider") as HTMLInputElement;
const nilSlider = document.getElementById("nil-slider") as HTMLInputElement;
const scheduleGenerateBtn = document.getElementById("schedule-generate-btn") as HTMLButtonElement;
const scoutBtn = document.getElementById("scout-btn") as HTMLButtonElement;
const scheduleList = document.getElementById("schedule-list") as HTMLUListElement;
const resultsList = document.getElementById("results-list") as HTMLUListElement;
const scoutReport = document.getElementById("scout-report") as HTMLDivElement;
const goalsList = document.getElementById("goals-list") as HTMLUListElement;
const weeklySummaryList = document.getElementById("weekly-summary") as HTMLUListElement;
const standingsList = document.getElementById("standings-list") as HTMLUListElement | null;
const postseasonLogDiv = document.getElementById("postseason-log") as HTMLDivElement | null;
const resultsDayEl = document.getElementById("results-day") as HTMLSpanElement | null;
const resultsWeekEl = document.getElementById("results-week") as HTMLSpanElement | null;
const resultsRecordEl = document.getElementById("results-record") as HTMLSpanElement | null;
const restFatigueBtn = document.getElementById("rest-fatigue-btn") as HTMLButtonElement | null;
const healMinorsBtn = document.getElementById("heal-minors-btn") as HTMLButtonElement | null;
const strategySelect = document.getElementById("strategy-select") as HTMLSelectElement | null;
const autoFillBtn = document.getElementById("auto-fill-btn") as HTMLButtonElement | null;
const bumpToggle = document.getElementById("bump-toggle") as HTMLInputElement | null;
const dualTeamLeft = document.getElementById("dual-team-left") as HTMLDivElement | null;
const dualTeamRight = document.getElementById("dual-team-right") as HTMLDivElement | null;
const dualDayLabel = document.getElementById("dual-day-label") as HTMLDivElement | null;
const dualNextDayBtn = document.getElementById("dual-next-day-btn") as HTMLButtonElement | null;
const homeDayLabel = document.getElementById("home-day-label") as HTMLDivElement | null;
const homeTeamNameEl = document.getElementById("home-team-name") as HTMLHeadingElement | null;
const homeNextDayBtn = document.getElementById("home-next-day-btn") as HTMLButtonElement | null;
const tileDistrict = document.getElementById("tile-district-rank") as HTMLDivElement | null;
const tileRegional = document.getElementById("tile-regional-rank") as HTMLDivElement | null;
const tileState = document.getElementById("tile-state-rank") as HTMLDivElement | null;
const navButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".nav-btn"));
const views = Array.from(document.querySelectorAll<HTMLElement>(".view"));
const rankingTabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".ranking-tab"));
const rankingTableBody = document.querySelector("#ranking-table-body") as HTMLTableSectionElement | null;
const rankingPrevBtn = document.getElementById("ranking-prev-btn") as HTMLButtonElement | null;
const rankingNextBtn = document.getElementById("ranking-next-btn") as HTMLButtonElement | null;
const rankingPageInfo = document.getElementById("ranking-page-info") as HTMLSpanElement | null;
const rankingFindInput = document.getElementById("ranking-find-input") as HTMLInputElement | null;
const rankingFindBtn = document.getElementById("ranking-find-btn") as HTMLButtonElement | null;
const rankingHeaders = Array.from(document.querySelectorAll<HTMLTableCellElement>("#ranking-table thead th[data-sort]"));
const latestResultEl = document.getElementById("latest-result") as HTMLParagraphElement | null;
const nextOpponentEl = document.getElementById("next-opponent") as HTMLParagraphElement | null;
const trainingEffectsEl = document.getElementById("training-effects") as HTMLParagraphElement | null;
const restPreviewEl = document.getElementById("rest-preview") as HTMLDivElement | null;
const healPreviewEl = document.getElementById("heal-preview") as HTMLDivElement | null;
const tournamentBracketsEl = document.getElementById("tournament-brackets") as HTMLDivElement | null;
const tournamentRunBtn = document.getElementById("tournament-run-btn") as HTMLButtonElement | null;
const tournamentScoresEl = document.getElementById("tournament-scores") as HTMLOListElement | null;
const tournamentChampionEl = document.getElementById("tournament-champion") as HTMLDivElement | null;
const tournamentErrorEl = document.getElementById("tournament-error") as HTMLDivElement | null;
const offseasonRecapEl = document.getElementById("offseason-recap") as HTMLParagraphElement | null;
const programSelectSection = document.getElementById("program-select") as HTMLElement;
const programGrid = document.getElementById("program-grid") as HTMLDivElement;
const gameUI = document.getElementById("game-ui") as HTMLElement;
const programNameEl = document.getElementById("program-name") as HTMLElement;
const programBlurbEl = document.getElementById("program-blurb") as HTMLElement;
const programPrestigeEl = document.getElementById("program-prestige") as HTMLElement;
const switchProgramBtn = document.getElementById("switch-program-btn") as HTMLButtonElement;
let gazetteOverlay = document.getElementById("gazette-overlay") as HTMLDivElement | null;
let gazetteHeadlineEl: HTMLHeadingElement | null = null;
let gazetteBlurbEl: HTMLParagraphElement | null = null;
let gazetteScoreEl: HTMLDivElement | null = null;
let gazetteSecondaryEl: HTMLUListElement | null = null;
let gazetteLabelEl: HTMLSpanElement | null = null;
let gazetteReactionEl: HTMLDivElement | null = null;
let gazetteFeedbackEl: HTMLDivElement | null = null;
let gazetteContinueBtn: HTMLButtonElement | null = null;
let gazetteBoxBtn: HTMLButtonElement | null = null;
let liveDualView: HTMLElement | null = null;
let liveTitleEl: HTMLElement | null = null;
let liveScoreEl: HTMLElement | null = null;
let liveBoutEl: HTMLElement | null = null;
let liveButtonsEl: HTMLElement | null = null;
let liveStartBtn: HTMLButtonElement | null = null;
let liveStrategyEl: HTMLElement | null = null;






// ---- Rendering ----

function refreshRosterUI(missingWeights: number[] = []) {
  ensureLineupSelections(lineupSelections, roster, WEIGHT_CLASSES);
  renderRosterList(rosterList, roster, overallScore);

  if (lineupGrid) {
    lineupGrid.innerHTML = "";
    for (const wc of WEIGHT_CLASSES) {
      const candidates = roster.filter((r) => r.weightClass === wc);
      const selectedId = lineupSelections[wc] || candidates[0]?.id || "";
      const card = buildLineupCard({
        weightClass: wc,
        wrestlers: candidates,
        selectedId,
        overallScore,
        onSelect: (value) => {
        lineupSelections[wc] = value;
          refreshRosterUI();
        },
      });
      if (missingWeights.includes(wc)) {
        card.classList.add("lineup-error");
      }
      lineupGrid.appendChild(card);
    }
  }

  const renderOptions = (select: HTMLSelectElement) => {
    select.innerHTML = "";
    for (const w of roster) {
      const opt = document.createElement("option");
      opt.value = w.id;
      opt.textContent = w.name;
      select.appendChild(opt);
    }
  };

  renderOptions(selectA);
  renderOptions(selectB);
}

function renderDualBoard(container: HTMLElement | null, teamA: Team, teamB: Team, result: DualResult) {
  if (!container) return;
  const leftColor = currentProgram?.colors?.[0] || "#0ea5e9";
  const rightColor = "#f97316";
  const boutsHtml = result.bouts
    .map((b) => {
      const aWin = b.winnerSide === "A";
      const bWin = b.winnerSide === "B";
      const method = b.method === "forfeit" ? "Forfeit" : b.method;
      const wcLabel = `${b.weightClass} lbs`;
      return `
      <div class="dual-bout">
        <div class="wc">${wcLabel}</div>
        <div class="wrestler ${aWin ? "win" : bWin ? "loss" : ""}">${b.a ? b.a.name : "Open"}</div>
        <div class="result ${aWin ? "win" : bWin ? "loss" : ""}">${method}</div>
        <div class="wrestler ${bWin ? "win" : aWin ? "loss" : ""}">${b.b ? b.b.name : "Open"}</div>
      </div>`;
    })
    .join("");

  container.innerHTML = `
    <div class="dual-board">
      <div class="dual-header">
        <div class="dual-team" style="border: 2px solid ${leftColor}">${teamA.name} (${result.scoreA})</div>
        <div class="dual-middle">Dual</div>
        <div class="dual-team" style="border: 2px solid ${rightColor}">${teamB.name} (${result.scoreB})</div>
      </div>
      <div class="dual-bouts">
        ${boutsHtml}
      </div>
    </div>
  `;
}


// ---- Persistence ----






function saveRoster() {

  if (!currentProgram) {

    logToElement(resultLog, "Select a program before saving.");

    return;

  }



  const state: SavedState<Wrestler, Prospect, DualResult, LeagueTeam, LiveDualState | null> = {
    roster,
    teamName,
    dayOfWeek,
    seasonWeek,
    seasonWins,
    seasonLosses,
    programId: currentProgram?.id,
    lineupSelections,
    recruits,
    shortlist,
    budget,
    nilBudget,
    committedThisSeason,
    weeklySummaries,
    league,
    postseasonLog,
    postseasonBracket,
    signedRecruits,
    prestige: currentProgram?.prestige,
    postseasonPlayed,
    liveDualState,
  };
  saveState(STORAGE_KEY, state, (msg) => logToElement(resultLog, msg));

}



function loadRoster(initial = false) {
  const parsed = loadState<SavedState<Wrestler, Prospect, DualResult, LeagueTeam, LiveDualState | null>>(
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    initial ? undefined : (msg) => logToElement(resultLog, msg)
  );
  if (!parsed) return;

  try {
    teamName = parsed.teamName || teamName;
    if (teamNameInput) teamNameInput.value = teamName;

    dayOfWeek = parsed.dayOfWeek || 1;
    budget = parsed.budget || budget;
    nilBudget = parsed.nilBudget || nilBudget;

  if (parsed.programId) {
    const found = PROGRAMS.find((p) => p.id === parsed.programId);
    if (found) applyProgram(found, { keepTeamName: true, skipRosterGeneration: true });
  } else {
    applyProgram(PROGRAMS[0], { keepTeamName: true, skipRosterGeneration: true });
  }


    seasonWeek = parsed.seasonWeek || 1;

    seasonWins = parsed.seasonWins || 0;

    seasonLosses = parsed.seasonLosses || 0;

    updateSeasonUI();



    if (!parsed.roster || !Array.isArray(parsed.roster)) {
      logToElement(resultLog, "Saved data is invalid.");
      return;
    }



  roster.length = 0;
  for (const w of parsed.roster) {
    const assignedClass = w.classYear || pickRandom(CLASS_YEARS);
    const assignedPotential = w.potential || clampStat(overallScore(w) + Math.floor(Math.random() * 10) - 3);
    roster.push({
      id: w.id || createId(),
      name: w.name,
      weight: w.weight,
      weightClass: w.weightClass || getWeightClass(w.weight),
      neutral: w.neutral,
      top: w.top,
      bottom: w.bottom,
      strength: w.strength,
      conditioning: w.conditioning,
      technique: w.technique,
      morale: w.morale || 70,
      health: w.health || 95,
      fatigue: w.fatigue || 20,
      classYear: assignedClass,
      potential: assignedPotential,
      injury: w.injury,
      form: w.form,
      formDays: w.formDays,
    });
  }

    if (parsed.lineupSelections) {
      Object.assign(lineupSelections, parsed.lineupSelections);
    }

    if (parsed.recruits && Array.isArray(parsed.recruits)) {
      recruits.length = 0;
      recruits.push(...parsed.recruits);
    }
    if (parsed.shortlist && Array.isArray(parsed.shortlist)) {
      shortlist.length = 0;
      shortlist.push(...parsed.shortlist);
    }
    committedThisSeason = parsed.committedThisSeason || committedThisSeason;
    if (parsed.weeklySummaries && Array.isArray(parsed.weeklySummaries)) {
      weeklySummaries.length = 0;
      weeklySummaries.push(...parsed.weeklySummaries);
    }
    if (parsed.league && Array.isArray(parsed.league)) {
      league = parsed.league;
    } else {
      initLeague();
    }
    postseasonLog = parsed.postseasonLog || "";
    postseasonBracket = parsed.postseasonBracket || {};
    if (parsed.signedRecruits && Array.isArray(parsed.signedRecruits)) {
      signedRecruits.length = 0;
      signedRecruits.push(...parsed.signedRecruits);
    }
    if (currentProgram && typeof parsed.prestige === "number") {
      currentProgram.prestige = parsed.prestige;
    }
    postseasonPlayed = parsed.postseasonPlayed || false;
    liveDualState = parsed.liveDualState || null;

    if (roster.length === 0 && currentProgram) {
      generateRosterForProgram(currentProgram);
    } else {
      ensureLineupSelections(lineupSelections, roster, WEIGHT_CLASSES);
      autoFillLineupIfEmpty();
      refreshRosterUI();
    }
    if (schedule.length === 0) {
      generateSeasonSchedule();
    }
    renderRecruitLists();
    renderSchedule();
    renderGoals();
    renderWeeklySummaries();
    if (!initial) logToElement(resultLog, "Roster loaded.");
  } catch (err) {
    console.error(err);
    logToElement(resultLog, "Error loading roster.");
  }
}


// ---- Dual Meet (Intra-squad) ----

function buildIntraSquadTeams(all: Wrestler[]): { red: Team; green: Team } {

  const red: Team = { name: "Red", wrestlers: [] };

  const green: Team = { name: "Green", wrestlers: [] };



  for (const wc of WEIGHT_CLASSES) {

    const inClass = all

      .filter((w) => w.weightClass === wc)

      .sort((a, b) => a.weight - b.weight);



    if (inClass.length >= 1) red.wrestlers.push(inClass[0]);

    if (inClass.length >= 2) green.wrestlers.push(inClass[1]);

  }



  return { red, green };

}



// Build a team from the best available wrestler at each weight
function buildTeamFromRoster(all: Wrestler[], name: string): Team {
  const wrestlers: Wrestler[] = [];
    ensureLineupSelections(lineupSelections, roster, WEIGHT_CLASSES);
  for (const wc of WEIGHT_CLASSES) {
    const chosenId = lineupSelections[wc];
    let chosen: Wrestler | undefined;
    if (chosenId) {
      chosen = all.find((w) => w.id === chosenId);
    }
    if (!chosen) {
      chosen = bestCandidateForWeight(wc);
    }
    if (!chosen && allowBump) {
      // try to bump from lower weight not already used
      const lower = all
        .filter((w) => w.weightClass === WEIGHT_CLASSES[WEIGHT_CLASSES.indexOf(wc) - 1])
        .sort((a, b) => overallScore(b) - overallScore(a));
      if (lower[0]) chosen = lower[0];
    }
    if (chosen) {
      if (!isMajorInjury(chosen)) {
        wrestlers.push(chosen);
      }
    }
  }
  refreshLatestSummary();
  return { name, wrestlers };
}


// Generate a rival team based roughly on your lineup

function generateOpponentTeam(base: Team, nameOverride?: string): Team {
  const wrestlers: Wrestler[] = [];
  for (const w of base.wrestlers) {
    const variance = 8; // how swingy rivals are
    const clone: Wrestler = {
      ...w,

      id: createId(),

      name: `${pickRandom(FIRST_NAMES)} ${pickRandom(LAST_NAMES)}`,

      neutral: clampStat(w.neutral + randomDelta(variance)),

      top: clampStat(w.top + randomDelta(variance)),

      bottom: clampStat(w.bottom + randomDelta(variance)),

      strength: clampStat(w.strength + randomDelta(variance)),

      conditioning: clampStat(w.conditioning + randomDelta(variance)),
      technique: clampStat(w.technique + randomDelta(variance)),
      morale: 70,
      health: 95,
      fatigue: 25,
    };
    wrestlers.push(clone);
  }
  return { name: nameOverride || pickRandom(SCHOOL_NAMES), wrestlers };
}

function pickOpponentNames(count: number): string[] {
  const mine = teamName || "My Team";
  const pool = PROGRAMS.map((p) => p.name).filter((n) => n !== mine);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  while (shuffled.length < count) {
    const candidate = `${pickRandom(SCHOOL_NAMES)}`;
    if (candidate !== mine && !shuffled.includes(candidate)) shuffled.push(candidate);
  }
  return shuffled.slice(0, count);
}

function generateSeasonSchedule(count = 8): void {
  schedule.length = 0;
  const my = buildTeamFromRoster(roster, teamName || "My Team");
  const opponents = pickOpponentNames(count);
  for (let i = 0; i < count; i++) {
    const name = opponents[i];
    const opp = generateOpponentTeam(my, name);
    schedule.push({ week: i + 1, opponent: opp, isTournament: i === count - 1 });
  }
  renderSchedule();
  nextOpponent = schedule.find((e) => !e.result)?.opponent || null;
  refreshLatestSummary();
}

function renderSchedule(): void {
  if (scheduleList) {
    scheduleList.innerHTML = "";
    for (const ev of schedule.filter((e) => !e.result)) {
      const li = document.createElement("li");
      li.innerHTML = `<div><strong>Week ${ev.week}</strong> <span class="meta">${ev.opponent.name}${ev.isTournament ? ' - Tournament (Sat)' : ' - Dual (Wed)'}</span></div>`;
      scheduleList.appendChild(li);
    }
  }
  if (resultsList) {
    resultsList.innerHTML = "";
    for (const ev of schedule.filter((e) => e.result)) {
      const r = ev.result!;
      const li = document.createElement("li");
      const label = ev.isTournament ? "Tournament" : ev.opponent.name;
      const detail = ev.isTournament ? r.log : `${r.scoreA}-${r.scoreB}`;
      li.innerHTML = `<div><strong>Week ${ev.week} • ${label}</strong> <span class="meta">${detail}</span></div>`;
      resultsList.appendChild(li);
    }
  }
  refreshLatestSummary();
}


function getRatingByName(name: string): number {
  const found = league.find((t) => t.name === name);
  return found?.rating ?? 1200;
}

function getStarters(): Wrestler[] {
  const starters: Wrestler[] = [];
  for (const wc of WEIGHT_CLASSES) {
    const id = lineupSelections[wc];
    if (!id) continue;
    const w = roster.find((r) => r.id === id);
    if (w) starters.push(w);
  }
  return starters;
}

function generateDualStories(myTeam: Team, rival: Team, result: DualResult, outcome: "WIN" | "LOSS" | "TIE", isPostseason = false): GazetteStory[] {
  const stories: GazetteStory[] = [];
  const margin = Math.abs(result.scoreA - result.scoreB);
  const myRating = getRatingByName(myTeam.name);
  const oppRating = getRatingByName(rival.name);
  const ratingDiff = myRating - oppRating;

  const upsetWin = outcome === "WIN" && ratingDiff < -50;
  const upsetLoss = outcome === "LOSS" && ratingDiff > 50;
  const blowout = margin >= 15;
  const clutch = margin <= 3;

  if (upsetWin) {
    stories.push({
      type: "team_upset",
      importance: 100 + Math.abs(ratingDiff),
      headline: `${myTeam.name} shocks ${rival.name}`,
      blurb: `${myTeam.name} toppled a higher-rated ${rival.name} squad by ${result.scoreA}-${result.scoreB}${isPostseason ? " in postseason action." : "."}`,
      tags: ["team", "upset"],
    });
  } else if (upsetLoss) {
    stories.push({
      type: "team_upset",
      importance: 90 + Math.abs(ratingDiff),
      headline: `${rival.name} stuns ${myTeam.name}`,
      blurb: `${rival.name} capitalized on mistakes to win ${result.scoreB}-${result.scoreA}${isPostseason ? " and advance." : "."}`,
      tags: ["team", "upset"],
    });
  }

  if (blowout) {
    stories.push({
      type: "blowout",
      importance: 70 + margin,
      headline: `${result.scoreA > result.scoreB ? myTeam.name : rival.name} rolls in blowout`,
      blurb: `The dual was never in doubt as the margin hit ${margin} points.`,
      tags: ["blowout"],
    });
  }

  if (clutch && !blowout) {
    stories.push({
      type: "clutch_match",
      importance: 65,
      headline: `Decided in the final bouts`,
      blurb: `${myTeam.name} ${outcome === "WIN" ? "escaped" : "fell"} ${result.scoreA}-${result.scoreB} after a nail-biter finish.`,
      tags: ["clutch"],
    });
  }

  // Individual stories
  for (const bout of result.bouts) {
    if (!bout.a || !bout.b) continue;
    const winner = bout.winnerSide === "A" ? bout.a : bout.b;
    const loser = bout.winnerSide === "A" ? bout.b : bout.a;
    const winSideIsMyTeam = bout.winnerSide === "A";
    const scoreDiff = overallScore(winner) - overallScore(loser);
    if (scoreDiff < -8) {
      stories.push({
        type: "individual_upset",
        importance: 55 + Math.abs(scoreDiff),
        headline: `Upset at ${bout.weightClass} lbs`,
        blurb: `${winner.name} shocked ${loser.name} with a ${bout.method} at ${bout.weightClass}.`,
        tags: [winner.name, loser.name, String(bout.weightClass), winSideIsMyTeam ? "my_team" : "rival"],
      });
    } else if (bout.method === "pin" || bout.method === "tech fall") {
      stories.push({
        type: "star_dominated",
        importance: 40 + (bout.method === "pin" ? 8 : 5),
        headline: `${winner.name} dominates at ${bout.weightClass}`,
        blurb: `${winner.name} earned a ${bout.method} to give ${winSideIsMyTeam ? myTeam.name : rival.name} bonus points.`,
        tags: [winner.name, String(bout.weightClass)],
      });
    }
  }

  if (stories.length === 0) {
    stories.push({
      type: "default",
      importance: 10,
      headline: `${myTeam.name} ${outcome === "WIN" ? "edges" : outcome === "LOSS" ? "falls to" : "splits with"} ${rival.name}`,
      blurb: `Final score ${result.scoreA}-${result.scoreB}.`,
      tags: [],
    });
  }

  return stories.sort((a, b) => b.importance - a.importance).slice(0, 5);
}

function applyModifiersToWrestler(w: Wrestler, modifiers: CoachingModifier[]): Wrestler {
  const clone = { ...w };
  for (const mod of modifiers) {
    if (mod.type === "push") {
      clone.neutral = clampStat(clone.neutral + 2);
      clone.conditioning = clampStat(clone.conditioning + 1);
    } else if (mod.type === "solid") {
      clone.bottom = clampStat(clone.bottom + 1);
      clone.top = clampStat(clone.top + 1);
    }
  }
  return clone;
}

function simulateBoutWithStrategy(a: Wrestler, b: Wrestler, dualStrategy: "balanced" | "aggressive" | "conservative", modifiers: CoachingModifier[]): { result: BoutResult; pointsA: number; pointsB: number } {
  const aAdj = applyModifiersToWrestler(a, modifiers);
  const bAdj = { ...b }; // opponent unchanged
  const strategyMod = dualStrategy === "aggressive" ? 1.05 : dualStrategy === "conservative" ? 0.95 : 1;
  const aFatigue = aAdj.fatigue || 20;
  const bFatigue = bAdj.fatigue || 20;
  const aHealth = aAdj.health || 100;
  const bHealth = bAdj.health || 100;
  const aMorale = aAdj.morale || 70;
  const bMorale = bAdj.morale || 70;

  const aInjuryPenalty =
    aAdj.injury && aAdj.injury.days > 0
      ? aAdj.injury.type === "major"
        ? 0.6
        : aAdj.injury.type === "moderate"
        ? 0.8
        : 0.9
      : 1;
  const bInjuryPenalty =
    bAdj.injury && bAdj.injury.days > 0
      ? bAdj.injury.type === "major"
        ? 0.6
        : bAdj.injury.type === "moderate"
        ? 0.8
        : 0.9
      : 1;

  const aStyle = aAdj.neutral * 0.3 + aAdj.top * 0.25 + aAdj.bottom * 0.2 + aAdj.technique * 0.25;
  const bStyle = bAdj.neutral * 0.3 + bAdj.top * 0.25 + bAdj.bottom * 0.2 + bAdj.technique * 0.25;

  const aBase =
    (overallScore(aAdj) + aStyle * 0.05 + (aMorale - 70) * 0.1 + (aHealth - 90) * 0.05 - aFatigue * 0.1 + (aAdj.form || 0) * 1.2) *
    aInjuryPenalty *
    strategyMod;
  const bBase =
    (overallScore(bAdj) + bStyle * 0.05 + (bMorale - 70) * 0.1 + (bHealth - 90) * 0.05 - bFatigue * 0.1 + (bAdj.form || 0) * 1.2) *
    bInjuryPenalty;

  const aScore = aBase + Math.random() * 10;
  const bScore = bBase + Math.random() * 10;
  const winner = aScore >= bScore ? a : b;
  const loser = winner === a ? b : a;
  const diff = Math.abs(aScore - bScore);
  let method: WinMethod = "decision";
  let winnerSide: "A" | "B" = aScore >= bScore ? "A" : "B";

  const solidActive = modifiers.some((m) => m.type === "solid");
  const pinThreshold = solidActive ? 18 : 15;

  if (diff > pinThreshold) method = "pin";
  else if (diff > 10) method = "tech fall";
  else if (diff > 6) method = "major";

  const summary = `${winner.name} defeats ${loser.name} by ${method}.`;
  const result: BoutResult = {
    weightClass: winner.weightClass,
    a,
    b,
    winnerSide,
    method,
    summary,
  };
  const pointsA = winnerSide === "A" ? teamPointsForMethod(method) : 0;
  const pointsB = winnerSide === "B" ? teamPointsForMethod(method) : 0;

  return { result, pointsA, pointsB };
}


function renderScoutReport(opponent: Team | null): void {
  if (!scoutReport) return;
  if (!opponent) {
    scoutReport.textContent = "No opponent scheduled.";
    return;
  }
  const lines = opponent.wrestlers
    .map((w) => `${w.weightClass} lbs: ${w.name} (OVR ${overallScore(w).toFixed(1)})`)
    .join("\n");
  scoutReport.textContent = `Scouting ${opponent.name}\n${lines}`;
}




function buildLiveBouts(opponent: Team): LiveBoutState[] {
  const bouts: LiveBoutState[] = [];
  for (const wc of WEIGHT_CLASSES) {
    const myId = lineupSelections[wc];
    const myW = myId ? roster.find((r) => r.id === myId) : undefined;
    const oppW = opponent.wrestlers.find((r) => r.weightClass === wc);
    bouts.push({ weightClass: wc, a: myW, b: oppW });
  }
  return bouts;
}

function startLiveDual(opponent: Team, trainingNote?: string, isPostseason = false, scheduledWeek?: number): void {
  ensureLiveDualUI();
  const myTeam = buildTeamFromRoster(roster, teamName || "My Team");
  liveDualState = {
    active: true,
    myTeam,
    opponent,
    bouts: buildLiveBouts(opponent),
    currentIndex: 0,
    scoreA: 0,
    scoreB: 0,
    strategy,
    modifiers: [],
    isPostseason,
    scheduledWeek,
    trainingNote,
  };
  setActiveView("live-dual");
  updateLiveDualUI();
  saveRoster();
}

function applyModifier(type: "push" | "solid"): void {
  if (!liveDualState) return;
  liveDualState.modifiers.push({ type, remaining: 2 });
  if (liveButtonsEl) {
    const msg = type === "push" ? "Pace push set for next bouts." : "Staying solid for next bouts.";
    liveButtonsEl.setAttribute("data-msg", msg);
  }
  saveRoster();
  updateLiveDualUI();
}

function quickFinishLiveDual(): void {
  if (!liveDualState) return;
  const state = liveDualState;
  while (liveDualState && state.currentIndex < state.bouts.length) {
    // expire modifiers each bout
    state.modifiers = state.modifiers
      .map((m) => ({ ...m, remaining: m.remaining - 1 }))
      .filter((m) => m.remaining > 0);
    const bout = state.bouts[state.currentIndex];
    if (!bout) break;
    if (!bout.a && !bout.b) {
      // nothing happens
    } else if (!bout.a) {
      state.scoreB += 6;
      bout.result = { weightClass: bout.weightClass, winnerSide: "B", method: "forfeit", summary: `${state.opponent.name} wins by forfeit` };
    } else if (!bout.b) {
      state.scoreA += 6;
      bout.result = { weightClass: bout.weightClass, winnerSide: "A", method: "forfeit", summary: `${state.myTeam.name} wins by forfeit` };
    } else {
      const { result, pointsA, pointsB } = simulateBoutWithStrategy(bout.a, bout.b, state.strategy, state.modifiers);
      bout.result = result;
      state.scoreA += pointsA;
      state.scoreB += pointsB;
    }
    state.currentIndex++;
  }
  updateLiveDualUI();
  finalizeLiveDual();
}

function updateLiveDualUI(): void {
  if (!liveDualState) return;
  ensureLiveDualUI();
  if (!liveTitleEl || !liveScoreEl || !liveBoutEl || !liveButtonsEl || !liveStartBtn || !liveStrategyEl) return;
  const state = liveDualState;
  liveTitleEl.textContent = `${state.myTeam.name} vs ${state.opponent.name}`;
  liveScoreEl.textContent = `Team Score: ${state.myTeam.name} ${state.scoreA} - ${state.scoreB} ${state.opponent.name}`;
  liveStrategyEl.textContent = `Strategy: ${state.strategy}`;

  const bout = state.bouts[state.currentIndex];
  if (!bout) {
    liveBoutEl.textContent = "Dual complete.";
    liveStartBtn.textContent = "Finish Dual";
  } else {
    const rows = state.bouts.map((b, idx) => {
      const aName = b.a ? `${b.a.name}` : "Open";
      const bName = b.b ? `${b.b.name}` : "Open";
      const aOvr = b.a ? overallScore(b.a).toFixed(1) : "--";
      const bOvr = b.b ? overallScore(b.b).toFixed(1) : "--";
      const status = b.result
        ? `${b.result.summary}`
        : idx === state.currentIndex
          ? "In progress"
          : "Not started";
      const homeClass = b.result ? (b.result.winnerSide === "A" ? "win" : b.result.winnerSide === "B" ? "loss" : "") : "";
      const awayClass = b.result ? (b.result.winnerSide === "B" ? "win" : b.result.winnerSide === "A" ? "loss" : "") : "";
      const currentClass = idx === state.currentIndex ? "current" : "";
      return `
        <div class="live-entry ${currentClass}">
          <div class="live-col home ${homeClass}">
            <div>${b.weightClass} lbs</div>
            <div><strong>${aName}</strong></div>
            <div class="meta">OVR ${aOvr}</div>
          </div>
          <div class="live-col result">
            <div class="meta">${status}</div>
          </div>
          <div class="live-col away ${awayClass}">
            <div>${b.weightClass} lbs</div>
            <div><strong>${bName}</strong></div>
            <div class="meta">OVR ${bOvr}</div>
          </div>
        </div>
      `;
    });
    liveBoutEl.innerHTML = `<div class="live-board">${rows.join("")}</div>`;
    liveStartBtn.textContent = bout.result ? "Next Bout" : "Start Bout";
  }

  liveButtonsEl.innerHTML = "";
  if (state.bouts[state.currentIndex]) {
    const stratLabel = document.createElement("div");
    stratLabel.className = "meta";
    stratLabel.textContent = "Adjust strategy:";
    liveButtonsEl!.appendChild(stratLabel);
    ["balanced", "aggressive", "conservative"].forEach((s) => {
      const btn = document.createElement("button");
      btn.textContent = s === "balanced" ? "Balanced" : s === "aggressive" ? "Aggressive" : "Conservative";
      btn.disabled = state.strategy === s;
      btn.addEventListener("click", () => {
        state.strategy = s as any;
        saveRoster();
        updateLiveDualUI();
      });
      liveButtonsEl!.appendChild(btn);
    });

    const pepLabel = document.createElement("div");
    pepLabel.className = "meta";
    pepLabel.textContent = "Pep talk:";
    liveButtonsEl!.appendChild(pepLabel);
    const pushBtn = document.createElement("button");
    pushBtn.textContent = "Push the pace (+neutral, small fatigue)";
    pushBtn.onclick = () => {
      applyModifier("push");
      for (const w of getStarters()) {
        w.fatigue = Math.min(100, (w.fatigue || 0) + 2);
      }
      refreshRosterUI();
    };
    liveButtonsEl!.appendChild(pushBtn);
    const solidBtn = document.createElement("button");
    solidBtn.textContent = "Stay solid (reduce pin risk)";
    solidBtn.onclick = () => applyModifier("solid");
    liveButtonsEl!.appendChild(solidBtn);

    const quickBtn = document.createElement("button");
    quickBtn.textContent = "Quick finish dual";
    quickBtn.onclick = () => quickFinishLiveDual();
    liveButtonsEl!.appendChild(quickBtn);
  }

  liveStartBtn.disabled = false;
}

function advanceLiveBout(): void {
  if (!liveDualState) return;
  const state = liveDualState;
  const bout = state.bouts[state.currentIndex];
  if (!bout) {
    finalizeLiveDual();
    return;
  }

  // expire modifiers
  state.modifiers = state.modifiers
    .map((m) => ({ ...m, remaining: m.remaining - 1 }))
    .filter((m) => m.remaining > 0);

  if (!bout.a && !bout.b) {
    state.currentIndex++;
    updateLiveDualUI();
    saveRoster();
    return;
  }
  if (!bout.a) {
    state.scoreB += 6;
    bout.result = { weightClass: bout.weightClass, winnerSide: "B", method: "forfeit", summary: `${state.opponent.name} wins by forfeit` };
  } else if (!bout.b) {
    state.scoreA += 6;
    bout.result = { weightClass: bout.weightClass, winnerSide: "A", method: "forfeit", summary: `${state.myTeam.name} wins by forfeit` };
  } else {
    const { result, pointsA, pointsB } = simulateBoutWithStrategy(bout.a, bout.b, state.strategy, state.modifiers);
    bout.result = result;
    state.scoreA += pointsA;
    state.scoreB += pointsB;
  }

  state.currentIndex++;
  updateLiveDualUI();
  saveRoster();
  if (state.currentIndex >= state.bouts.length) {
    finalizeLiveDual();
  }
}

function finalizeLiveDual(): void {
  if (!liveDualState) return;
  const state = liveDualState;
  const scoreA = state.scoreA;
  const scoreB = state.scoreB;
  const outcome: "WIN" | "LOSS" | "TIE" = scoreA === scoreB ? "TIE" : scoreA > scoreB ? "WIN" : "LOSS";
  const logLines: string[] = [];
  for (const b of state.bouts) {
    if (b.result) logLines.push(`${b.weightClass}: ${b.result.summary}`);
  }
  logLines.push(`Final: ${state.myTeam.name} ${scoreA} - ${scoreB} ${state.opponent.name}`);
  const dualResult: DualResult = { log: logLines.join("\n"), scoreA, scoreB, bouts: state.bouts.map((b) => b.result!).filter(Boolean) };

  if (state.scheduledWeek) {
    const ev = schedule.find((e) => e.week === state.scheduledWeek);
    if (ev) ev.result = dualResult;
  }

  if (outcome === "WIN") seasonWins++;
  else if (outcome === "LOSS") seasonLosses++;
  if (seasonLog) seasonLog.textContent = dualResult.log;
  latestResultSummary = `Week ${seasonWeek}: ${state.myTeam.name} ${scoreA}-${scoreB} ${state.opponent.name}`;
  seasonWeek++;
  dayOfWeek = dayOfWeek === tournamentDay ? 1 : dayOfWeek + 1;

  for (const w of roster) {
    w.fatigue = Math.min(100, (w.fatigue || 20) + 12);
    w.health = Math.max(40, (w.health || 95) - 3);
    if (w.injury && w.injury.days > 0) w.injury.days = Math.max(0, w.injury.days - 1);
    w.morale = clampStat((w.morale || 70) + (outcome === "WIN" ? 3 : outcome === "TIE" ? 0 : -2));
  }

  const summary = `Week ${seasonWeek - 1}: ${state.myTeam.name} ${scoreA}-${scoreB} ${state.opponent.name}${state.trainingNote ? ` | ${state.trainingNote}` : ""}`;
  updateLeague(state.myTeam.name, state.opponent.name, scoreA, scoreB);
  renderStandings();
  const stories = generateDualStories(state.myTeam, state.opponent, dualResult, outcome, state.isPostseason);
  const payload: GazettePayload = {
    stories,
    scoreA,
    scoreB,
    myTeam: state.myTeam,
    opponent: state.opponent,
    outcome,
    label: computeOutcomeLabel({
      stories,
      scoreA,
      scoreB,
      myTeam: state.myTeam,
      opponent: state.opponent,
      outcome,
      label: "",
    }),
  };
  addWeeklySummary(summary + (stories[0]?.headline ? ` | ${stories[0].headline}` : ""));
  renderGazette(payload);
  refreshLatestSummary();

  liveDualState = null;
  if (seasonWeek > schedule.length && !postseasonPlayed && state.isPostseason) {
    runPostseason();
    postseasonPlayed = true;
    advanceSeason();
  }
  renderSchedule();
  updateSeasonUI();
  saveRoster();
  setActiveView("home");
}

function simulateIntraSquadDual(): string {

  if (roster.length === 0) {

    return "No wrestlers on the roster.";

  }



  const { red, green } = buildIntraSquadTeams(roster);

  const { log } = simulateDual(red, green);

  return log;

}



function updateSeasonUI() {
  const dayLabel = DAYS[dayOfWeek - 1] || String(dayOfWeek);
  if (seasonDaySpan) seasonDaySpan.textContent = dayLabel;
  if (seasonWeekSpan) seasonWeekSpan.textContent = String(seasonWeek);
  if (seasonRecordSpan) seasonRecordSpan.textContent = `${seasonWins}-${seasonLosses}`;
  if (resultsDayEl) resultsDayEl.textContent = dayLabel;
  if (resultsWeekEl) resultsWeekEl.textContent = String(seasonWeek);
  if (resultsRecordEl) resultsRecordEl.textContent = `${seasonWins}-${seasonLosses}`;
  if (budgetSlider) budgetSlider.value = String(budget);
  if (nilSlider) nilSlider.value = String(nilBudget);
  if (homeDayLabel) {
    const readable =
      dayOfWeek === dualDay ? "Wednesday (Dual)" : dayOfWeek === tournamentDay ? "Saturday (Tournament)" : `Day ${dayOfWeek}`;
    homeDayLabel.textContent = readable;
  }
  if (homeTeamNameEl) homeTeamNameEl.textContent = teamName || "Your School";
}

function simulateSeasonDual(trainingNote?: string): { outcome: string; summary: string; payload: GazettePayload } | null {
  if (roster.length === 0) {
    if (seasonLog) seasonLog.textContent = "Add wrestlers first.";
    return null;
  }
  if (!ensureLineupReady()) return null;

  const myTeam = buildTeamFromRoster(roster, teamName || "My Team");
  const scheduled = schedule.find((e) => e.week === seasonWeek);
  let rival: Team;
  if (scheduled) {
    rival = scheduled.opponent;
  } else if (nextOpponent) {
    rival = nextOpponent;
  } else {
    rival = generateOpponentTeam(myTeam, pickRandom(SCHOOL_NAMES));
  }
  const { log, scoreA, scoreB, bouts } = simulateDual(myTeam, rival);

  let outcome: "WIN" | "LOSS" | "TIE";

  if (scoreA > scoreB) {
    seasonWins++;
    outcome = "WIN";

  } else if (scoreB > scoreA) {

    seasonLosses++;

    outcome = "LOSS";

  } else {

    outcome = "TIE";

  }


  if (seasonLog) seasonLog.textContent = `Week ${seasonWeek}: ${outcome}\n\n` + log;

  if (scheduled) {
    scheduled.result = { log, scoreA, scoreB, bouts };
  }

  seasonWeek++;
  nextOpponent = null;
  renderSchedule();
  updateSeasonUI();
  renderStandings();
  if (seasonWeek > schedule.length) {
    if (!postseasonPlayed) {
      runPostseason();
      postseasonPlayed = true;
      advanceSeason();
    }
  }

  // post-dual fatigue/health changes
  for (const w of roster) {
    w.fatigue = Math.min(100, (w.fatigue || 20) + 12);
    w.health = Math.max(40, (w.health || 95) - 3);
    if (w.injury && w.injury.days > 0) {
      w.injury.days = Math.max(0, w.injury.days - 1);
    }
    w.morale = clampStat((w.morale || 70) + (outcome === "WIN" ? 3 : outcome === "TIE" ? 0 : -2));
  }

  const summary = `Week ${seasonWeek - 1}: ${myTeam.name} ${scoreA}-${scoreB} ${rival.name}${trainingNote ? ` | ${trainingNote}` : ""}`;
  updateLeague(myTeam.name, rival.name, scoreA, scoreB);
  renderStandings();
  const stories = generateDualStories(myTeam, rival, { log, scoreA, scoreB, bouts }, outcome, false);
  const payload: GazettePayload = {
    stories,
    scoreA,
    scoreB,
    myTeam,
    opponent: rival,
    outcome,
    label: computeOutcomeLabel({
      stories,
      scoreA,
      scoreB,
      myTeam,
      opponent: rival,
      outcome,
      label: "",
    }),
  };
  renderGazette(payload);
  latestResultSummary = summary;
  refreshLatestSummary();
  return { outcome, summary, payload };
}

function buildTournamentField(): Wrestler[] | null {
  if (roster.length === 0) {
    if (tournamentErrorEl) tournamentErrorEl.textContent = "Generate a roster first to build brackets.";
    return null;
  }
  return [...roster];
}

function simulateWeightBracket(wrestlers: Wrestler[], weightClass: number): WeightBracket | null {
  const seeds = wrestlers.filter((w) => w.weightClass === weightClass);
  while (seeds.length < 8) {
    const opp = generateTournamentOpponent(weightClass);
    seeds.push(opp);
  }
  const play = (a: Wrestler, b: Wrestler, round: TournamentMatch["round"]): TournamentMatch => {
    const result = simulateMatch({ ...a }, { ...b });
    return { round, a, b, result };
  };
  const winner = (match: TournamentMatch): Wrestler => match.result.winner;
  const qfPairs: [Wrestler, Wrestler][] = [
    [seeds[0], seeds[7]],
    [seeds[3], seeds[4]],
    [seeds[2], seeds[5]],
    [seeds[1], seeds[6]],
  ];
  const quarterfinals = qfPairs.map(([a, b]) => play(a, b, "Quarterfinal"));
  const semifinals: TournamentMatch[] = [
    play(winner(quarterfinals[0]), winner(quarterfinals[1]), "Semifinal"),
    play(winner(quarterfinals[2]), winner(quarterfinals[3]), "Semifinal"),
  ];
  const final = play(winner(semifinals[0]), winner(semifinals[1]), "Final");
  const champion = final.result.winner.name;
  return { weightClass, quarterfinals, semifinals, final, champion };
}

function simulateTournamentBracket(): TournamentBracket | null {
  const field = buildTournamentField();
  if (!field) return null;
  const brackets: WeightBracket[] = [];
  const placings: { weightClass: number; champion?: string; runnerUp?: string }[] = [];
  for (const wc of WEIGHT_CLASSES) {
    const bracket = simulateWeightBracket(field, wc);
    if (bracket) {
      brackets.push(bracket);
      placings.push({ weightClass: wc, champion: bracket.champion });
    }
  }
  if (brackets.length === 0) {
    if (tournamentErrorEl) tournamentErrorEl.textContent = "No weight classes available for brackets.";
    return null;
  }
  if (tournamentErrorEl) tournamentErrorEl.textContent = "";
  return { weights: brackets, placings };
}

function renderTournamentBracket(bracket: TournamentBracket): void {
  if (!tournamentBracketsEl || !tournamentScoresEl || !tournamentChampionEl) return;

  const createCard = (match: TournamentMatch): HTMLElement => {
    const div = document.createElement("div");
    div.className = "bracket-card";
    const aWins = match.result.winner.id === match.a.id;
    const aRow = `
      <div class="team-row ${aWins ? "winner" : ""}">
        <div class="name">${match.a.name}</div>
        <div class="score">${aWins ? "W" : ""}</div>
      </div>`;
    const bRow = `
      <div class="team-row ${!aWins ? "winner" : ""}">
        <div class="name">${match.b.name}</div>
        <div class="score">${!aWins ? "W" : ""}</div>
      </div>`;
    const highlight = `${match.a.weightClass} lbs • ${match.result.method}`;
    div.innerHTML = `
      <div class="match-body">
        ${aRow}
        ${bRow}
        <div class="match-meta">${highlight}</div>
      </div>
    `;
    return div;
  };

  tournamentBracketsEl.innerHTML = "";
  tournamentScoresEl.innerHTML = "";
  tournamentChampionEl.textContent = "";

  bracket.weights.forEach((wb) => {
    const wrapper = document.createElement("div");
    wrapper.className = "weight-bracket";
    wrapper.innerHTML = `<h4>${wb.weightClass} lbs</h4>`;

    const qfCol = document.createElement("div");
    qfCol.className = "round-col";
    qfCol.innerHTML = "<h5>QF</h5>";
    wb.quarterfinals.forEach((m) => qfCol.appendChild(createCard(m)));

    const sfCol = document.createElement("div");
    sfCol.className = "round-col";
    sfCol.innerHTML = "<h5>SF</h5>";
    wb.semifinals.forEach((m) => sfCol.appendChild(createCard(m)));

    const finalCol = document.createElement("div");
    finalCol.className = "round-col";
    finalCol.innerHTML = "<h5>Final</h5>";
    if (wb.final) finalCol.appendChild(createCard(wb.final));

    wrapper.appendChild(qfCol);
    wrapper.appendChild(sfCol);
    wrapper.appendChild(finalCol);
    tournamentBracketsEl.appendChild(wrapper);
  });

  if (bracket.weights[0]?.champion) {
    tournamentChampionEl.textContent = `Champions crowned across ${bracket.weights.length} brackets`;
  }

  bracket.placings.forEach((entry) => {
    const li = document.createElement("li");
    const champ = entry.champion ? entry.champion : "—";
    li.textContent = `${entry.weightClass} lbs: ${champ}`;
    tournamentScoresEl.appendChild(li);
  });
  refreshLatestSummary();
}

function renderTournamentIfAvailable(): void {
  if (lastTournamentBracket) {
    renderTournamentBracket(lastTournamentBracket);
  }
}

function runPostseason(): void {
  if (league.length === 0) return;
  const sorted = [...league].sort((a, b) => {
    const wpA = a.wins + a.losses === 0 ? 0 : a.wins / (a.wins + a.losses);
    const wpB = b.wins + b.losses === 0 ? 0 : b.wins / (b.wins + b.losses);
    if (wpA !== wpB) return wpB - wpA;
    const diffA = a.pf - a.pa;
    const diffB = b.pf - b.pa;
    if (diffA !== diffB) return diffB - diffA;
    return (b.rating || 0) - (a.rating || 0);
  });
  const seeds = sorted.slice(0, 4);
  if (seeds.length < 4) {
    postseasonLog = "Not enough teams for postseason.";
    renderWeeklySummaries();
    return;
  }

  const seed1 = seeds[0];
  const seed2 = seeds[1];
  const seed3 = seeds[2];
  const seed4 = seeds[3];

  const team1 = generateOpponentTeam(buildTeamFromRoster(roster, seed1.name), seed1.name);
  const team2 = generateOpponentTeam(buildTeamFromRoster(roster, seed4.name), seed4.name);
  team1.name = seed1.name;
  team2.name = seed4.name;
  const semi1 = simulateDual(team1, team2);

  const team3 = generateOpponentTeam(buildTeamFromRoster(roster, seed2.name), seed2.name);
  const team4 = generateOpponentTeam(buildTeamFromRoster(roster, seed3.name), seed3.name);
  team3.name = seed2.name;
  team4.name = seed3.name;
  const semi2 = simulateDual(team3, team4);

  const finalistA = semi1.scoreA >= semi1.scoreB ? team1 : team2;
  const finalistB = semi2.scoreA >= semi2.scoreB ? team3 : team4;
  const final = simulateDual(finalistA, finalistB);
  const champion = final.scoreA >= final.scoreB ? finalistA : finalistB;

  postseasonBracket = { semifinal1: semi1, semifinal2: semi2, final };
  postseasonLog = `Semis: ${team1.name} ${semi1.scoreA}-${semi1.scoreB} ${team2.name} | ${team3.name} ${semi2.scoreA}-${semi2.scoreB} ${team4.name}\nFinal: ${finalistA.name} ${final.scoreA}-${final.scoreB} ${finalistB.name}\nChampion: ${champion.name}`;
  applyPrestigeAdjustments(league.find((t) => t.name === champion.name) || null);
  renderWeeklySummaries();
  latestResultSummary = postseasonLog;
  refreshLatestSummary();
}

function advanceSeason(): void {
  // Graduation and roster rollover (simple version)
  const returning: Wrestler[] = [];
  for (const w of roster) {
    if (w.classYear === "SR") continue;
    const nextYear =
      w.classYear === "JR" ? "SR" : w.classYear === "SO" ? "JR" : "SO";
    returning.push({ ...w, classYear: nextYear });
  }

  // Add signed recruits as new freshmen
  for (const p of signedRecruits) {
    const newW: Wrestler = {
      id: createId(),
      name: p.name,
      weight: p.weightClass,
      weightClass: p.weightClass,
      neutral: clampStat(p.rating),
      top: clampStat(p.rating),
      bottom: clampStat(p.rating),
      strength: clampStat(p.rating - 2),
      conditioning: clampStat(p.rating),
      technique: clampStat(p.rating),
      morale: 75,
      health: 95,
      fatigue: 15,
      classYear: "FR",
      potential: p.potential || clampStat(p.rating),
    };
    returning.push(newW);
  }

  roster.length = 0;
  roster.push(...returning);
  signedRecruits.length = 0;
  committedThisSeason = 0;

  applyOffseasonDevelopment();

  offseasonRecap = `Season recap: ${seasonWins}-${seasonLosses}. Postseason: ${postseasonLog || "None"}.`;

  // Reset season state
  initLeague();
  dayOfWeek = 1;
  seasonWeek = 1;
  seasonWins = 0;
  seasonLosses = 0;
  schedule.length = 0;
  postseasonBracket = {};
  postseasonLog = "";
  weeklySummaries.length = 0;
  postseasonPlayed = false;
  generateSeasonSchedule();
  updateSeasonUI();
  refreshRosterUI();
  renderStandings();
  renderWeeklySummaries();
  renderOffseasonRecap();
}

function applyTraining(focus: TrainingFocus): string {
  // small random improvements
  let improvedCount = 0;

  for (const w of roster) {
    let primaryStats: (keyof Wrestler)[] = [];

    let secondaryStats: (keyof Wrestler)[] = [];



    switch (focus) {

      case "neutral":

        primaryStats = ["neutral", "technique"];

        secondaryStats = ["conditioning"];

        break;

      case "top":

        primaryStats = ["top", "technique"];

        secondaryStats = ["strength"];

        break;

      case "bottom":

        primaryStats = ["bottom", "technique"];

        secondaryStats = ["conditioning"];

        break;

      case "strength":

        primaryStats = ["strength"];

        secondaryStats = ["neutral", "top", "bottom"];

        break;

      case "conditioning":

        primaryStats = ["conditioning"];

        secondaryStats = ["neutral", "bottom"];

        break;

      case "technique":

        primaryStats = ["technique"];

        secondaryStats = ["neutral", "top", "bottom"];

        break;

      case "balanced":

      default:

        primaryStats = ["neutral", "top", "bottom", "technique"];

        secondaryStats = ["strength", "conditioning"];

        break;

    }



    let changed = false;



    // primary stats: +0-2
    for (const key of primaryStats) {
      const bump = Math.floor(Math.random() * 3); // 0,1,2
      if (bump > 0) {
        const current = (w as any)[key] as number;
        const next = clampStat(current + bump);
        const cap = w.potential || 99;
        (w as any)[key] = Math.min(next, cap);
        changed = true;
      }
    }

    // secondary stats: +0-1
    for (const key of secondaryStats) {
      const bump = Math.floor(Math.random() * 2); // 0,1
      if (bump > 0) {
        const current = (w as any)[key] as number;
        const next = clampStat(current + bump);
        const cap = w.potential || 99;
        (w as any)[key] = Math.min(next, cap);
        changed = true;
      }
    }

    if (changed) improvedCount++;
    const trainingLoad = strategy === "aggressive" ? 5 : strategy === "conservative" ? -2 : 0;
    w.fatigue = Math.max(0, (w.fatigue || 20) - 8 + Math.floor((100 - budget) / 40) + trainingLoad);
    w.morale = clampStat((w.morale || 70) + 1);
    if (w.injury && w.injury.days > 0) {
      w.injury.days = Math.max(0, w.injury.days - 1);
    }
    if (w.formDays && w.formDays > 0) {
      w.formDays -= 1;
      if (w.formDays <= 0) w.form = 0;
    }
  }

  refreshRosterUI();

  return `Training focus: ${focus}. ${improvedCount} wrestlers improved today.`;
}

function applyOffseasonDevelopment(): void {
  for (const w of roster) {
    const cap = w.potential || 99;
    const dev = Math.max(1, Math.floor((cap - overallScore(w)) / 20));
    const bump = Math.min(OFFSEASON_DEV_BONUS, dev);
    w.neutral = Math.min(cap, w.neutral + bump);
    w.top = Math.min(cap, w.top + bump);
    w.bottom = Math.min(cap, w.bottom + bump);
    w.technique = Math.min(cap, w.technique + bump);
    w.strength = Math.min(cap, w.strength + Math.max(1, bump - 1));
    w.conditioning = Math.min(cap, w.conditioning + Math.max(1, bump - 1));
  }
}






// ---- Event Listeners ----

simulateBtn.addEventListener("click", () => {

  if (!ensureProgramSelected()) return;

  if (roster.length < 2) {

    resultLog.textContent = "You need at least two wrestlers to simulate a match.";

    return;

  }



  const idA = selectA.value;

  const idB = selectB.value;



  if (!idA || !idB || idA === idB) {

    resultLog.textContent = "Select two different wrestlers.";

    return;

  }



  const a = roster.find((w) => w.id === idA)!;

  const b = roster.find((w) => w.id === idB)!;



  const { summary } = simulateMatch(a, b);

  resultLog.textContent = summary;

});



saveBtn.addEventListener("click", () => {

  saveRoster();

});



loadBtn.addEventListener("click", () => {

  loadRoster();

});



dualBtn.addEventListener("click", () => {
  if (!ensureProgramSelected()) return;
  const text = simulateIntraSquadDual();
  dualLog.textContent = text;
});


switchProgramBtn.addEventListener("click", () => {

  const confirmed = window.confirm("Switch programs| This will reset roster and season progress.");

  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEY);

  resetProgramSelection();

  renderProgramSelect();

});



regenRosterBtn?.addEventListener("click", () => {

  if (!ensureProgramSelected() || !currentProgram) return;

  generateRosterForProgram(currentProgram);

  seasonWeek = 1;

  seasonWins = 0;

  seasonLosses = 0;

  updateSeasonUI();

});



teamNameInput.addEventListener("input", () => {

  teamName = teamNameInput.value || "My Team";

});



vsOpponentBtn.addEventListener("click", () => {
  if (!ensureProgramSelected()) return;
  const payload = simulateDualVsOpponent();
  if (!payload) return;
  renderDualBoard(vsOpponentLog, payload.myTeam, payload.rival, payload.result);
  vsOpponentLog.classList.add("log"); // ensure styling
});

if (quickSimBtn) {
  quickSimBtn.addEventListener("click", () => {
    if (!ensureProgramSelected()) return;
    if (!ensureLineupReady()) return;
    const myTeam = buildTeamFromRoster(roster, teamName || "My Team");
    const rival = generateOpponentTeam(myTeam, pickRandom(SCHOOL_NAMES));
    const result = simulateDual(myTeam, rival);
    renderDualBoard(vsOpponentLog, myTeam, rival, result);
    vsOpponentLog.classList.add("log");
  });
}

recruitGenerateBtn?.addEventListener("click", () => {
  generateProspects(currentProgram || undefined);
});

recruitDecayBtn?.addEventListener("click", () => {
  tickRecruitInterest();
});

budgetSlider?.addEventListener("input", () => {
  budget = Number(budgetSlider.value);
});

nilSlider?.addEventListener("input", () => {
  nilBudget = Number(nilSlider.value);
});

scheduleGenerateBtn?.addEventListener("click", () => {
  if (!ensureProgramSelected()) return;
  generateSeasonSchedule();
});

scoutBtn?.addEventListener("click", () => {
  if (!ensureProgramSelected()) return;
  const upcoming = schedule.find((e) => !e.result) || null;
  nextOpponent = upcoming?.opponent || nextOpponent;
  renderScoutReport(nextOpponent);
});

strategySelect?.addEventListener("change", () => {
  strategy = (strategySelect.value as any) || "balanced";
});
trainingSelect?.addEventListener("change", () => refreshTrainingEffects());
budgetSlider?.addEventListener("input", () => refreshTrainingEffects());
nilSlider?.addEventListener("input", () => refreshTrainingEffects());

const handleTournamentSim = () => {
  if (!ensureProgramSelected()) {
    if (tournamentErrorEl) tournamentErrorEl.textContent = "Select a program to simulate a bracket.";
    return;
  }
  const bracket = simulateTournamentBracket();
  if (bracket) {
    lastTournamentBracket = bracket;
    renderTournamentBracket(bracket);
    latestResultSummary = `Tournament simulated (${bracket.weights.length} brackets)`;
    refreshLatestSummary();
  }
};

tournamentRunBtn?.addEventListener("click", handleTournamentSim);

autoFillBtn?.addEventListener("click", () => {
  for (const wc of WEIGHT_CLASSES) {
    const best = bestCandidateForWeight(wc);
    lineupSelections[wc] = best ? best.id : null;
  }
  refreshRosterUI();
});

bumpToggle?.addEventListener("change", () => {
  allowBump = !!bumpToggle.checked;
});

dualNextDayBtn?.addEventListener("click", () => {
  seasonNextBtn.click();
});

restFatigueBtn?.addEventListener("click", () => {
  const tired = [...roster].sort((a, b) => (b.fatigue || 0) - (a.fatigue || 0)).slice(0, 3);
  for (const w of tired) {
    w.fatigue = Math.max(0, (w.fatigue || 0) - 15);
    w.health = Math.min(100, (w.health || 90) + 3);
  }
  refreshRosterUI();
  if (restPreviewEl) {
    const names = tired.map((w) => w.name).join(", ");
    restPreviewEl.textContent = names ? `Rested: ${names} (-15 fatigue, +3 health)` : "No wrestlers to rest.";
  }
  renderGoals();
});

healMinorsBtn?.addEventListener("click", () => {
  for (const w of roster) {
    if (w.injury && w.injury.type === "minor" && w.injury.days > 0) {
      w.injury.days = Math.max(0, w.injury.days - 2);
    }
  }
  refreshRosterUI();
  if (healPreviewEl) {
    const healed = roster.filter((w) => w.injury && w.injury.type === "minor");
    healPreviewEl.textContent = healed.length ? `Minor injuries treated: ${healed.length} wrestlers (-2 days)` : "No minor injuries to treat.";
  }
});

seasonNextBtn.addEventListener("click", () => {
  if (!ensureProgramSelected()) return;
  const scheduled = schedule.find((e) => e.week === seasonWeek);
  nextOpponent = scheduled?.opponent || nextOpponent;
  const focusValue = (trainingSelect?.value || "balanced") as TrainingFocus;
  const trainingSummary = applyTraining(focusValue);
  tickRecruitInterest();
  const isDualDay = dayOfWeek === dualDay;
  const isTournamentDay = dayOfWeek === tournamentDay;
  if (isDualDay || isTournamentDay) {
    if (liveDualState && liveDualState.active) {
      // If user clicks Next Day while a live dual is open, just quick-finish it to keep the loop unblocked.
      quickFinishLiveDual();
      return;
    }
    if (isTournamentDay) {
      const bracket = simulateTournamentBracket();
      if (!bracket) {
        if (seasonLog) seasonLog.textContent = `${trainingSummary}\n\nTournament simulation unavailable.`;
        return;
      }
      lastTournamentBracket = bracket;
      const champ = `Tournament simulated (${bracket.weights.length} brackets)`;
      if (scheduled) {
        scheduled.result = { log: champ, scoreA: 0, scoreB: 0, bouts: [] };
      }
      if (seasonLog) seasonLog.textContent = `${trainingSummary}\n\n${champ}`;
      renderTournamentBracket(bracket);
      dayOfWeek = 1;
      seasonWeek += 1;
      renderSchedule();
      updateSeasonUI();
      setActiveView("results");
      return;
    } else {
      if (!ensureLineupReady()) {
        return;
      }
      const myTeam = buildTeamFromRoster(roster, teamName || "My Team");
      let opponent: Team;
      if (scheduled) {
        opponent = scheduled.opponent;
      } else if (nextOpponent) {
        opponent = nextOpponent;
      } else {
        opponent = generateOpponentTeam(myTeam, pickRandom(SCHOOL_NAMES));
      }
      startLiveDual(opponent, trainingSummary, isTournamentDay, scheduled?.week);
      if (seasonLog) seasonLog.textContent = trainingSummary + "\n\n" + (seasonLog.textContent || "");
      return;
    }
  } else {
    dayOfWeek += 1;
    if (seasonLog) seasonLog.textContent = trainingSummary + "\n\n" + (seasonLog.textContent || "");
  }
  updateSeasonUI();
  renderGoals();
});


renderProgramSelect();
loadRoster(true);
updateSeasonUI();
renderStandings();
renderWeeklySummaries();
refreshLatestSummary();
renderOffseasonRecap();
refreshTrainingEffects();
const activeDual = liveDualState as LiveDualState | null;
if (activeDual && activeDual.active) {
  ensureLiveDualUI();
  updateLiveDualUI();
  setActiveView("live-dual");
} else {
  setActiveView("home");
}

// expose quick sim for potential debug/legacy flows
(window as any).quickSimSeasonDual = simulateSeasonDual;

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.view;
    if (!target) return;
    setActiveView(target);
    if (target === "results") renderTournamentIfAvailable();
  });
});

rankingTabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const scope = btn.dataset.scope as RankingScope | undefined;
    if (!scope) return;
    rankingScope = scope;
    rankingPage = 1;
    rankingTabButtons.forEach((b) => {
      const isActive = b.dataset.scope === scope;
      b.classList.toggle("active", isActive);
      b.setAttribute("aria-selected", `${isActive}`);
    });
    renderRankingTable();
  });
});

const triggerRankingSearch = () => {
  rankingFilter = (rankingFindInput?.value ?? "").trim();
  rankingPage = 1;
  renderRankingTable();
};

rankingFindBtn?.addEventListener("click", triggerRankingSearch);
rankingFindInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    triggerRankingSearch();
  }
});

rankingPrevBtn?.addEventListener("click", () => {
  if (rankingPage <= 1) return;
  rankingPage -= 1;
  renderRankingTable();
});

rankingNextBtn?.addEventListener("click", () => {
  rankingPage += 1;
  renderRankingTable();
});

rankingHeaders.forEach((header) => {
  header.addEventListener("click", () => {
    const sortKey = header.dataset.sort as RankingSortKey | undefined;
    if (!sortKey) return;
    if (rankingSort.key === sortKey) {
      rankingSort = { key: sortKey, direction: rankingSort.direction === "asc" ? "desc" : "asc" };
    } else {
      rankingSort = { key: sortKey, direction: sortKey === "name" ? "asc" : "desc" };
    }
    rankingPage = 1;
    renderRankingTable();
  });
});

document.querySelectorAll<HTMLElement>("[data-target]").forEach((el) => {
  el.addEventListener("click", () => {
    const target = (el as HTMLElement).dataset.target;
    if (!target) return;
    setActiveView(target);
    if (target === "results") renderTournamentIfAvailable();
  });
});

homeNextDayBtn?.addEventListener("click", () => {
  seasonNextBtn.click();
});











function updateLeague(teamAName: string, teamBName: string, scoreA: number, scoreB: number): void {
  if (league.length === 0) initLeague();
  const findOrAdd = (name: string): LeagueTeam => {
    let entry = league.find((t) => t.name === name);
    if (!entry) {
      entry = { name, wins: 0, losses: 0, pf: 0, pa: 0, rating: 1200, prestige: 80 };
      league.push(entry);
    }
    return entry;
  };
  const a = findOrAdd(teamAName);
  const b = findOrAdd(teamBName);

  a.pf += scoreA;
  a.pa += scoreB;
  b.pf += scoreB;
  b.pa += scoreA;

  if (scoreA > scoreB) {
    a.wins++;
    b.losses++;
    a.lastResult = "W";
    b.lastResult = "L";
  } else if (scoreB > scoreA) {
    b.wins++;
    a.losses++;
    b.lastResult = "W";
    a.lastResult = "L";
  }

  const eloK = 20;
  const expectedA = 1 / (1 + Math.pow(10, (b.rating - a.rating) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (a.rating - b.rating) / 400));
  const scoreAResult = scoreA === scoreB ? 0.5 : scoreA > scoreB ? 1 : 0;
  const scoreBResult = 1 - scoreAResult;
  a.rating = a.rating + eloK * (scoreAResult - expectedA);
  b.rating = b.rating + eloK * (scoreBResult - expectedB);

  renderStandings();
}

function applyPrestigeAdjustments(champion: LeagueTeam | null): void {
  if (!currentProgram || !champion) return;
  const myTeam = league.find((t) => t.name === currentProgram!.name);
  if (!myTeam) return;
  const winPct = myTeam.wins + myTeam.losses === 0 ? 0 : myTeam.wins / (myTeam.losses + myTeam.wins);
  if (myTeam.name === champion.name) {
    currentProgram!.prestige = clampStat((currentProgram!.prestige || 80) + 3);
  } else if (winPct < 0.3) {
    currentProgram!.prestige = clampStat((currentProgram!.prestige || 80) - 2);
  } else if (winPct >= 0.6) {
    currentProgram!.prestige = clampStat((currentProgram!.prestige || 80) + 1);
  }
}


function generateTournamentOpponent(weightClass: number): Wrestler {
  const program: Program =
    currentProgram ||
    {
      id: "at-large",
      name: "At-Large",
      prestige: 75,
      colors: ["#111", "#eee"],
      blurb: "",
      wrestlingPopularity: 7,
      athletics: 7,
    };
  const w = generateWrestler(program, weightClass);
  w.morale = 70;
  w.health = 95;
  w.fatigue = 20;
  return w;
}
