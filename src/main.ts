// ---- Types ----

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

type WinMethod = "decision" | "major" | "tech fall" | "pin";

interface BoutResult {
  weightClass: number;
  a?: Wrestler;
  b?: Wrestler;
  winnerSide: "A" | "B" | "none";
  method: WinMethod | "forfeit";
  summary: string;
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

function setActiveView(viewKey: string): void {
  for (const btn of navButtons) {
    btn.classList.toggle("active", btn.dataset.view === viewKey);
  }
  for (const v of views) {
    v.classList.toggle("active", v.id === `view-${viewKey}`);
  }
}

function renderStandings(): void {
  if (!standingsList) return;
  standingsList.innerHTML = "";
  if (league.length === 0) return;
  const sorted = [...league].sort((a, b) => {
    const winPctA = a.wins + a.losses === 0 ? 0 : a.wins / (a.wins + a.losses);
    const winPctB = b.wins + b.losses === 0 ? 0 : b.wins / (b.wins + b.losses);
    if (winPctA !== winPctB) return winPctB - winPctA;
    const diffA = a.pf - a.pa;
    const diffB = b.pf - b.pa;
    if (diffA !== diffB) return diffB - diffA;
    return b.rating - a.rating;
  });
  for (const team of sorted) {
    const diff = team.pf - team.pa;
    const winPct = team.wins + team.losses === 0 ? 0 : (team.wins / (team.wins + team.losses)) * 100;
    const li = document.createElement("li");
    if (team.name === teamName) li.classList.add("highlight");
    const prestigeStr = team.prestige ? ` | Prestige ${team.prestige}` : "";
    li.innerHTML = `<div><strong>${team.name}</strong> <span class="meta record">${team.wins}-${team.losses} (${winPct.toFixed(0)}%)</span></div><div class="meta">PF ${team.pf} | PA ${team.pa} | Diff ${diff} | Rating ${team.rating.toFixed(0)}${prestigeStr}${team.lastResult ? ` | ${team.lastResult}` : ""}</div>`;
    standingsList.appendChild(li);
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

const STORAGE_KEY = "wcg:save:v2";
const LEGACY_STORAGE_KEY = "wcg:roster:v1";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function initLeague(): void {
  league = PROGRAMS.map((p) => ({
    id: p.id,
    name: p.name,
    wins: 0,
    losses: 0,
    pf: 0,
    pa: 0,
    rating: p.prestige * 10,
    prestige: p.prestige,
  }));
  postseasonPlayed = false;
}




// College style weights (we can tweak later)

const WEIGHT_CLASSES = [125, 133, 141, 149, 157, 165, 174, 184, 197, 285];



import { SCHOOL_NAMES } from "./schools";

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
function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}


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

function bestCandidateForWeight(weightClass: number): Wrestler | undefined {
  return roster
    .filter((w) => w.weightClass === weightClass)
    .sort((a, b) => overallScore(b) - overallScore(a))[0];
}

function ensureLineupSelections(): void {
  for (const wc of WEIGHT_CLASSES) {
    const selectedId = lineupSelections[wc];
    const exists = selectedId ? roster.some((w) => w.id === selectedId) : false;
    if (exists) continue;
    const best = bestCandidateForWeight(wc);
    lineupSelections[wc] = best ? best.id : null;
  }
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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
  ensureLineupSelections();
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

function teamPointsForMethod(method: WinMethod): number {

  switch (method) {

    case "pin":

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



function simulateDualVsOpponent(): { result: DualResult; myTeam: Team; rival: Team } | null {
  if (roster.length === 0) {
    resultLog.textContent = "Add wrestlers first.";
    return null;
  }
  const myTeam = buildTeamFromRoster(roster, teamName || "My Team");
  const rival = generateOpponentTeam(myTeam);
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





// ---- Match Simulation ----

function simulateMatch(
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

  const strategyMod =
    strategy === "aggressive" ? 1.05 : strategy === "conservative" ? 0.95 : 1;

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

  // form updates
  winner.form = Math.min(2, (winner.form || 0) + 1);
  winner.formDays = 5;
  loser.form = Math.max(-2, (loser.form || 0) - 1);
  loser.formDays = 5;

  return { winner, loser, method, summary };
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
const programSelectSection = document.getElementById("program-select") as HTMLElement;
const programGrid = document.getElementById("program-grid") as HTMLDivElement;
const gameUI = document.getElementById("game-ui") as HTMLElement;
const programNameEl = document.getElementById("program-name") as HTMLElement;
const programBlurbEl = document.getElementById("program-blurb") as HTMLElement;
const programPrestigeEl = document.getElementById("program-prestige") as HTMLElement;
const switchProgramBtn = document.getElementById("switch-program-btn") as HTMLButtonElement;






// ---- Rendering ----

function refreshRosterUI() {
  ensureLineupSelections();
  rosterList.innerHTML = "";
  for (const w of roster) {
    const li = document.createElement("li");
    const injury = w.injury && w.injury.days > 0 ? ` | ${w.injury.type} (${w.injury.days}d)` : "";
    const formBadge = w.form && w.form !== 0 ? ` | Form ${w.form > 0 ? "+" : ""}${w.form}` : "";
    li.textContent = `${w.name} (${w.weight} lbs, ${w.weightClass}) | OVR ${overallScore(w).toFixed(1)}${injury}${formBadge}`;
    rosterList.appendChild(li);
  }

  if (lineupGrid) {
    lineupGrid.innerHTML = "";
    for (const wc of WEIGHT_CLASSES) {
      const candidates = roster.filter((r) => r.weightClass === wc);
      const selectedId = lineupSelections[wc] || candidates[0]?.id || "";
      const w = candidates.find((c) => c.id === selectedId);
      const card = document.createElement("div");
      card.className = "lineup-card";
      const name = w ? w.name : "Open";
      const ovr = w ? overallScore(w).toFixed(1) : "--";
      const badges: string[] = [];
      if (w && w.injury && w.injury.days > 0) badges.push(`${w.injury.type} (${w.injury.days}d)`);
      if (w && w.form) badges.push(`Form ${w.form > 0 ? "+" : ""}${w.form}`);
      if (w && w.fatigue && w.fatigue > 70) badges.push(`Fatigue ${w.fatigue}`);
      const select = document.createElement("select");
      const openOpt = document.createElement("option");
      openOpt.value = "";
      openOpt.textContent = "Open Slot";
      select.appendChild(openOpt);
      for (const c of candidates) {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.name} (OVR ${overallScore(c).toFixed(1)})`;
        select.appendChild(opt);
      }
      select.value = selectedId || "";
      select.addEventListener("change", (e) => {
        const value = (e.target as HTMLSelectElement).value;
        lineupSelections[wc] = value || null;
        refreshRosterUI();
      });
      card.innerHTML = `
        <h3>${wc} lbs</h3>
        <p class="name">${name}</p>
        <p class="meta">${w ? `OVR ${ovr}` : "No wrestler"}</p>
      `;
      if (badges.length) {
        const badgeWrap = document.createElement("div");
        badgeWrap.className = "badges";
        for (const b of badges) {
          const span = document.createElement("span");
          span.className = "badge";
          span.textContent = b;
          badgeWrap.appendChild(span);
        }
        card.appendChild(badgeWrap);
      }
      lineupGrid.appendChild(card);
    }
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

interface SavedState {
  roster: Wrestler[];
  teamName?: string;
  dayOfWeek?: number;
  seasonWeek?: number;
  seasonWins?: number;
  seasonLosses?: number;
  lineupSelections?: Record<number, string | null>;
  recruits?: Prospect[];
  shortlist?: Prospect[];
  programId?: string;
  budget?: number;
  nilBudget?: number;
  committedThisSeason?: number;
  weeklySummaries?: string[];
  league?: LeagueTeam[];
  postseasonLog?: string;
  postseasonBracket?: { semifinal1?: DualResult; semifinal2?: DualResult; final?: DualResult };
  signedRecruits?: Prospect[];
  prestige?: number;
  postseasonPlayed?: boolean;
}






function saveRoster() {

  if (!currentProgram) {

    resultLog.textContent = "Select a program before saving.";

    return;

  }



  const state: SavedState = {
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
  };
  try {

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    resultLog.textContent = "Roster saved.";

  } catch (err) {

    console.error(err);

    resultLog.textContent = "Error saving roster.";

  }

}



function loadRoster(initial = false) {

  let raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {

    raw = localStorage.getItem(LEGACY_STORAGE_KEY);

  }

  if (!raw) {

    if (!initial) resultLog.textContent = "No saved roster found.";

    return;

  }



  try {
    const parsed = JSON.parse(raw) as SavedState;
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

      resultLog.textContent = "Saved data is invalid.";

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

    if (roster.length === 0 && currentProgram) {
      generateRosterForProgram(currentProgram);
    } else {
      ensureLineupSelections();
      refreshRosterUI();
    }
    if (schedule.length === 0) {
      generateSeasonSchedule();
    }
    renderRecruitLists();
    renderSchedule();
    renderGoals();
    renderWeeklySummaries();
    if (!initial) resultLog.textContent = "Roster loaded.";
  } catch (err) {
    console.error(err);
    resultLog.textContent = "Error loading roster.";
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
  ensureLineupSelections();
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
      const isMajorInjured = chosen.injury && chosen.injury.type === "major" && chosen.injury.days > 0;
      if (!isMajorInjured) {
        wrestlers.push(chosen);
      }
    }
  }
  return { name, wrestlers };
}


function randomDelta(range: number): number {

  return Math.floor((Math.random() * 2 - 1) * range); // -range .. +range

}



// Generate a rival team based roughly on your lineup

function generateOpponentTeam(base: Team): Team {
  const wrestlers: Wrestler[] = [];
  for (const w of base.wrestlers) {
    const variance = 8; // how swingy rivals are
    const clone: Wrestler = {
      ...w,

      id: createId(),

      name: `Rival ${w.weightClass}`, // simple placeholder names

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
  return { name: "Rival High", wrestlers };
}

function generateSeasonSchedule(count = 8): void {
  schedule.length = 0;
  const my = buildTeamFromRoster(roster, teamName || "My Team");
  for (let i = 0; i < count; i++) {
    const opp = generateOpponentTeam(my);
    schedule.push({ week: i + 1, opponent: opp, isTournament: i === count - 1 });
  }
  renderSchedule();
  nextOpponent = schedule.find((e) => !e.result)?.opponent || null;
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
      li.innerHTML = `<div><strong>Week ${ev.week}</strong> <span class="meta">${r.scoreA}-${r.scoreB}</span></div>`;
      resultsList.appendChild(li);
    }
  }
}


// Generic dual engine

function simulateDual(teamA: Team, teamB: Team): DualResult {
  let scoreA = 0;
  let scoreB = 0;
  const lines: string[] = [];
  const bouts: BoutResult[] = [];

  lines.push(`${teamA.name} vs ${teamB.name}`);
  lines.push(`--------------------------------`);

  for (const wc of WEIGHT_CLASSES) {
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

    const { winner, method, summary } = simulateMatch(aW!, bW!);
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
  if (budgetSlider) budgetSlider.value = String(budget);
  if (nilSlider) nilSlider.value = String(nilBudget);
  if (homeDayLabel) {
    const readable =
      dayOfWeek === dualDay ? "Wednesday (Dual)" : dayOfWeek === tournamentDay ? "Saturday (Tournament)" : `Day ${dayOfWeek}`;
    homeDayLabel.textContent = readable;
  }
  if (homeTeamNameEl) homeTeamNameEl.textContent = teamName || "Your School";
}

function simulateSeasonDual(trainingNote?: string): { outcome: string; summary: string } | null {
  if (roster.length === 0) {
    seasonLog.textContent = "Add wrestlers first.";
    return null;
  }

  const myTeam = buildTeamFromRoster(roster, teamName || "My Team");
  const scheduled = schedule.find((e) => e.week === seasonWeek);
  let rival: Team;
  if (scheduled) {
    rival = scheduled.opponent;
  } else if (nextOpponent) {
    rival = nextOpponent;
  } else {
    rival = generateOpponentTeam(myTeam);
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


  seasonLog.textContent = `Week ${seasonWeek}: ${outcome}\n\n` + log;

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
  return { outcome, summary };
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

  const team1 = generateOpponentTeam(buildTeamFromRoster(roster, seed1.name));
  const team2 = generateOpponentTeam(buildTeamFromRoster(roster, seed4.name));
  team1.name = seed1.name;
  team2.name = seed4.name;
  const semi1 = simulateDual(team1, team2);

  const team3 = generateOpponentTeam(buildTeamFromRoster(roster, seed2.name));
  const team4 = generateOpponentTeam(buildTeamFromRoster(roster, seed3.name));
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
  renderGoals();
});

healMinorsBtn?.addEventListener("click", () => {
  for (const w of roster) {
    if (w.injury && w.injury.type === "minor" && w.injury.days > 0) {
      w.injury.days = Math.max(0, w.injury.days - 2);
    }
  }
  refreshRosterUI();
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
    const result = simulateSeasonDual(trainingSummary);
    if (result) addWeeklySummary(result.summary);
    if (seasonWeek > schedule.length && !postseasonPlayed && isTournamentDay) {
      runPostseason();
      postseasonPlayed = true;
      advanceSeason();
    }
    dayOfWeek = isTournamentDay ? 1 : dayOfWeek + 1;
    seasonLog.textContent = trainingSummary + "\n\n" + seasonLog.textContent;
  } else {
    dayOfWeek += 1;
    seasonLog.textContent = trainingSummary + "\n\n" + (seasonLog.textContent || "");
  }
  updateSeasonUI();
  renderGoals();
});


renderProgramSelect();
loadRoster(true);
updateSeasonUI();
renderStandings();
renderWeeklySummaries();
setActiveView("home");

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.view;
    if (!target) return;
    setActiveView(target);
  });
});

document.querySelectorAll<HTMLButtonElement>(".tile-card").forEach((tile) => {
  tile.addEventListener("click", () => {
    const target = tile.dataset.target;
    if (!target) return;
    setActiveView(target);
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


