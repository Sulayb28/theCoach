// ---- Types ----
interface Wrestler {
  id: string;
  name: string;
  weight: number;
  neutral: number;
  top: number;
  bottom: number;
  strength: number;
  conditioning: number;
  technique: number;
}

// ---- State ----
const roster: Wrestler[] = [];
const STORAGE_KEY = "wcg:roster:v1";

// ---- Helpers ----
function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
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

// ---- Match Simulation ----
function simulateMatch(a: Wrestler, b: Wrestler): { winner: Wrestler; loser: Wrestler; summary: string } {
  const aBase = overallScore(a);
  const bBase = overallScore(b);

  const aScore = aBase + Math.random() * 10;
  const bScore = bBase + Math.random() * 10;

  const winner = aScore >= bScore ? a : b;
  const loser = winner === a ? b : a;

  const diff = Math.abs(aScore - bScore);
  let method = "decision";

  if (diff > 15) method = "pin";
  else if (diff > 10) method = "tech fall";
  else if (diff > 6) method = "major decision";

  const summary = `${winner.name} defeats ${loser.name} by ${method}.`;

  return { winner, loser, summary };
}

// ---- DOM Elements ----
const form = document.getElementById("add-wrestler-form") as HTMLFormElement;
const rosterList = document.getElementById("roster-list") as HTMLUListElement;
const selectA = document.getElementById("wrestler-a") as HTMLSelectElement;
const selectB = document.getElementById("wrestler-b") as HTMLSelectElement;
const simulateBtn = document.getElementById("simulate-btn") as HTMLButtonElement;
const resultLog = document.getElementById("result-log") as HTMLDivElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const loadBtn = document.getElementById("load-btn") as HTMLButtonElement;

// ---- Rendering ----
function refreshRosterUI() {
  rosterList.innerHTML = "";
  for (const w of roster) {
    const li = document.createElement("li");
    li.textContent = `${w.name} (${w.weight} lbs) | OVR ${overallScore(w).toFixed(1)}`;
    rosterList.appendChild(li);
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

// ---- Persistence ----
interface SavedState {
  roster: Wrestler[];
}

function saveRoster() {
  const state: SavedState = { roster };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    resultLog.textContent = "Roster saved.";
  } catch (err) {
    console.error(err);
    resultLog.textContent = "Error saving roster.";
  }
}

function loadRoster() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    // silent on first load; only show message if user clicked "Load"
    return;
  }

  try {
    const parsed = JSON.parse(raw) as SavedState;
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
        neutral: w.neutral,
        top: w.top,
        bottom: w.bottom,
        strength: w.strength,
        conditioning: w.conditioning,
        technique: w.technique,
      });
    }

    refreshRosterUI();
    resultLog.textContent = "Roster loaded.";
  } catch (err) {
    console.error(err);
    resultLog.textContent = "Error loading roster.";
  }
}

// ---- Event Listeners ----
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = (document.getElementById("name") as HTMLInputElement).value.trim();
  const weight = Number((document.getElementById("weight") as HTMLInputElement).value);

  const neutral = clampStat(Number((document.getElementById("neutral") as HTMLInputElement).value));
  const top = clampStat(Number((document.getElementById("top") as HTMLInputElement).value));
  const bottom = clampStat(Number((document.getElementById("bottom") as HTMLInputElement).value));
  const strength = clampStat(Number((document.getElementById("strength") as HTMLInputElement).value));
  const conditioning = clampStat(Number((document.getElementById("conditioning") as HTMLInputElement).value));
  const technique = clampStat(Number((document.getElementById("technique") as HTMLInputElement).value));

  if (!name || !weight) {
    resultLog.textContent = "Name and weight are required.";
    return;
  }

  const wrestler: Wrestler = {
    id: createId(),
    name,
    weight,
    neutral,
    top,
    bottom,
    strength,
    conditioning,
    technique,
  };

  roster.push(wrestler);
  refreshRosterUI();
  form.reset();
  resultLog.textContent = `Added ${name} to the roster.`;
});

simulateBtn.addEventListener("click", () => {
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

// Auto-load if something is saved
loadRoster();
