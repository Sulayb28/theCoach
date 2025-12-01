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



// ---- State & constants ----
const roster: Wrestler[] = [];
let teamName = "My Team";
let currentProgram: Program | null = null;

let seasonWeek = 1;
let seasonWins = 0;
let seasonLosses = 0;

const STORAGE_KEY = "wcg:save:v2";
const LEGACY_STORAGE_KEY = "wcg:roster:v1";



// College style weights (we can tweak later)
const WEIGHT_CLASSES = [125, 133, 141, 149, 157, 165, 174, 184, 197, 285];

const PROGRAMS: Program[] = [
  {
    id: "penn-state",
    name: "Penn State",
    prestige: 99,
    colors: ["#1b3a5d", "#c8a200"],
    blurb: "Dynasty standard. Expect title-or-bust pressure and elite recruits.",
    wrestlingPopularity: 10,
    athletics: 10,
  },
  {
    id: "iowa",
    name: "Iowa",
    prestige: 96,
    colors: ["#111827", "#fbbf24"],
    blurb: "Hard-nosed room with fan intensity. Duals are events, not matches.",
    wrestlingPopularity: 10,
    athletics: 9,
  },
  {
    id: "oklahoma-state",
    name: "Oklahoma State",
    prestige: 94,
    colors: ["#b45309", "#0b1120"],
    blurb: "Historic cowboy swagger. High expectations for bonus points.",
    wrestlingPopularity: 9,
    athletics: 8,
  },
  {
    id: "ohio-state",
    name: "Ohio State",
    prestige: 92,
    colors: ["#9ca3af", "#ef4444"],
    blurb: "Big-ten spotlight, modern style. NIL buzz keeps talent flowing.",
    wrestlingPopularity: 8,
    athletics: 9,
  },
  {
    id: "michigan",
    name: "Michigan",
    prestige: 90,
    colors: ["#0b1b35", "#eab308"],
    blurb: "Balanced roster builds with patient development and deep game-plans.",
    wrestlingPopularity: 7,
    athletics: 8,
  },
  {
    id: "cornell",
    name: "Cornell",
    prestige: 88,
    colors: ["#991b1b", "#f59e0b"],
    blurb: "Ivy grind with technical polish. Overachieves with smart recruiting.",
    wrestlingPopularity: 8,
    athletics: 7,
  },
  {
    id: "arizona-state",
    name: "Arizona State",
    prestige: 86,
    colors: ["#7c2d12", "#d97706"],
    blurb: "Sunshine, freestyle flair, and west coast pipelines.",
    wrestlingPopularity: 7,
    athletics: 7,
  },
  {
    id: "minnesota",
    name: "Minnesota",
    prestige: 84,
    colors: ["#581c87", "#fbbf24"],
    blurb: "Upper-weight hammers and a gritty crowd vibe.",
    wrestlingPopularity: 7,
    athletics: 7,
  },
];

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
  const weight = weightClass + Math.floor(Math.random() * 7) - 3; // +- 3 lbs variance
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
    roster.push(generateWrestler(program, wc));
  }
  refreshRosterUI();
  resultLog.textContent = `${program.name} roster generated.`;
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
  if (teamNameInput) teamNameInput.value = teamName;
  if (programNameEl) programNameEl.textContent = program.name;
  if (programBlurbEl) programBlurbEl.textContent = program.blurb;
  if (programPrestigeEl) programPrestigeEl.textContent = String(program.prestige);

  if (programSelectSection) programSelectSection.classList.add("hidden");
  if (gameUI) gameUI.classList.remove("hidden");

  if (!opts?.skipRosterGeneration) {
    seasonWeek = 1;
    seasonWins = 0;
    seasonLosses = 0;
    generateRosterForProgram(program);
  }

  updateSeasonUI();
}

function resetProgramSelection(): void {
  currentProgram = null;
  teamName = "My Team";
  if (teamNameInput) teamNameInput.value = "";
  roster.length = 0;
  refreshRosterUI();
  seasonWeek = 1;
  seasonWins = 0;
  seasonLosses = 0;
  updateSeasonUI();
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
  const aBase = overallScore(a);
  const bBase = overallScore(b);

  const aScore = aBase + Math.random() * 10;
  const bScore = bBase + Math.random() * 10;

  const winner = aScore >= bScore ? a : b;
  const loser = winner === a ? b : a;

  const diff = Math.abs(aScore - bScore);
  let method: WinMethod = "decision";

  if (diff > 15) method = "pin";
  else if (diff > 10) method = "tech fall";
  else if (diff > 6) method = "major";

  const summary = `${winner.name} defeats ${loser.name} by ${method}.`;

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
const seasonWeekSpan = document.getElementById("season-week") as HTMLSpanElement;
const trainingSelect = document.getElementById("training-focus") as HTMLSelectElement;
const seasonRecordSpan = document.getElementById("season-record") as HTMLSpanElement;
const seasonNextBtn = document.getElementById("season-next-btn") as HTMLButtonElement;
const seasonLog = document.getElementById("season-log") as HTMLDivElement;
const regenRosterBtn = document.getElementById("regen-roster-btn") as HTMLButtonElement;
const lineupGrid = document.getElementById("lineup-grid") as HTMLDivElement;
const programSelectSection = document.getElementById("program-select") as HTMLElement;
const programGrid = document.getElementById("program-grid") as HTMLDivElement;
const gameUI = document.getElementById("game-ui") as HTMLElement;
const programNameEl = document.getElementById("program-name") as HTMLElement;
const programBlurbEl = document.getElementById("program-blurb") as HTMLElement;
const programPrestigeEl = document.getElementById("program-prestige") as HTMLElement;
const switchProgramBtn = document.getElementById("switch-program-btn") as HTMLButtonElement;



// ---- Rendering ----
function refreshRosterUI() {
  rosterList.innerHTML = "";
  for (const w of roster) {
    const li = document.createElement("li");
    li.textContent = `${w.name} (${w.weight} lbs, ${w.weightClass}) | OVR ${overallScore(w).toFixed(1)}`;
    rosterList.appendChild(li);
  }

  if (lineupGrid) {
    lineupGrid.innerHTML = "";
    for (const wc of WEIGHT_CLASSES) {
      const w = roster.find((r) => r.weightClass === wc);
      const card = document.createElement("div");
      card.className = "lineup-card";
      const name = w ? w.name : "Open";
      const ovr = w ? overallScore(w).toFixed(1) : "--";
      card.innerHTML = `
        <h3>${wc} lbs</h3>
        <p class="name">${name}</p>
        <p class="meta">${w ? `OVR ${ovr}` : "No wrestler"}</p>
      `;
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
  const leftColor = currentProgram?.colors?.[0] ?? "#0ea5e9";
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
  seasonWeek?: number;
  seasonWins?: number;
  seasonLosses?: number;
  programId?: string;
}



function saveRoster() {
  if (!currentProgram) {
    resultLog.textContent = "Select a program before saving.";
    return;
  }

  const state: SavedState = {
    roster,
    teamName,
    seasonWeek,
    seasonWins,
    seasonLosses,
    programId: currentProgram?.id,
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
    teamName = parsed.teamName ?? teamName;
    if (teamNameInput) teamNameInput.value = teamName;

    if (parsed.programId) {
      const found = PROGRAMS.find((p) => p.id === parsed.programId);
      if (found) applyProgram(found, { keepTeamName: true, skipRosterGeneration: true });
    } else {
      applyProgram(PROGRAMS[0], { keepTeamName: true, skipRosterGeneration: true });
    }

    seasonWeek = parsed.seasonWeek ?? 1;
    seasonWins = parsed.seasonWins ?? 0;
    seasonLosses = parsed.seasonLosses ?? 0;
    updateSeasonUI();

    if (!parsed.roster || !Array.isArray(parsed.roster)) {
      resultLog.textContent = "Saved data is invalid.";
      return;
    }

    roster.length = 0;
    for (const w of parsed.roster) {
      roster.push({
        id: w.id ?? createId(),
        name: w.name,
        weight: w.weight,
        weightClass: w.weightClass ?? getWeightClass(w.weight),
        neutral: w.neutral,
        top: w.top,
        bottom: w.bottom,
        strength: w.strength,
        conditioning: w.conditioning,
        technique: w.technique,
      });
    }

    if (roster.length === 0 && currentProgram) {
      generateRosterForProgram(currentProgram);
    } else {
      refreshRosterUI();
    }
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
  for (const wc of WEIGHT_CLASSES) {
    const candidates = all
      .filter((w) => w.weightClass === wc)
      .sort((a, b) => a.weight - b.weight);
    if (candidates[0]) wrestlers.push(candidates[0]);
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
    };
    wrestlers.push(clone);
  }
  return { name: "Rival High", wrestlers };
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

function simulateIntraSquadDual(): string {
  if (roster.length === 0) {
    return "No wrestlers on the roster.";
  }

  const { red, green } = buildIntraSquadTeams(roster);
  const { log } = simulateDual(red, green);
  return log;
}

function updateSeasonUI() {
  if (seasonWeekSpan) seasonWeekSpan.textContent = String(seasonWeek);
  if (seasonRecordSpan) seasonRecordSpan.textContent = `${seasonWins}-${seasonLosses}`;
}

function simulateSeasonDual(): void {
  if (roster.length === 0) {
    seasonLog.textContent = "Add wrestlers first.";
    return;
  }

  const myTeam = buildTeamFromRoster(roster, teamName || "My Team");
  const rival = generateOpponentTeam(myTeam);
  const { log, scoreA, scoreB } = simulateDual(myTeam, rival);

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

  seasonWeek++;
  updateSeasonUI();
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
        // @ts-expect-error - numeric fields only
        w[key] = clampStat((w[key] as number) + bump);
        changed = true;
      }
    }

    // secondary stats: +0-1
    for (const key of secondaryStats) {
      const bump = Math.floor(Math.random() * 2); // 0,1
      if (bump > 0) {
        // @ts-expect-error - numeric fields only
        w[key] = clampStat((w[key] as number) + bump);
        changed = true;
      }
    }

    if (changed) improvedCount++;
  }

  refreshRosterUI();

  return `Training focus: ${focus}. ${improvedCount} wrestlers improved this week.`;
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
  const confirmed = window.confirm("Switch programs? This will reset roster and season progress.");
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

seasonNextBtn.addEventListener("click", () => {
  if (!ensureProgramSelected()) return;
  const focusValue = (trainingSelect?.value || "balanced") as TrainingFocus;
  const trainingSummary = applyTraining(focusValue);
  simulateSeasonDual();
  // prepend training info above the dual log
  seasonLog.textContent = trainingSummary + "\n\n" + seasonLog.textContent;
});

renderProgramSelect();
loadRoster(true);
updateSeasonUI();

