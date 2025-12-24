// Roster UI interactions
import { WEIGHT_CLASSES } from "../data/weights";

export interface WrestlerCard {
  id: string;
  name: string;
  weightClass: number;
  injury?: { type: "minor" | "moderate" | "major"; days: number };
  form?: number;
  fatigue?: number;
}

export interface RosterCardOptions<T extends WrestlerCard> {
  weightClass: number;
  wrestlers: T[];
  selectedId: string | null | undefined;
  onSelect: (value: string | null) => void;
  overallScore: (w: T) => number;
}

export function renderRosterList<T extends WrestlerCard>(
  container: HTMLElement | null,
  wrestlers: T[],
  overallScore: (w: T) => number
): void {
  if (!container) return;
  container.innerHTML = "";
  wrestlers.forEach((w) => {
    const li = document.createElement("li");
    const injury = w.injury && w.injury.days > 0 ? ` | ${w.injury.type} (${w.injury.days}d)` : "";
    const formBadge = w.form && w.form !== 0 ? ` | Form ${w.form > 0 ? "+" : ""}${w.form}` : "";
    li.textContent = `${w.name} (${w.weightClass}) | OVR ${overallScore(w).toFixed(1)}${injury}${formBadge}`;
    container.appendChild(li);
  });
}

export function buildLineupCard<T extends WrestlerCard>(options: RosterCardOptions<T>): HTMLDivElement {
  const { weightClass, wrestlers, selectedId, onSelect, overallScore } = options;
  const card = document.createElement("div");
  card.className = "lineup-card";
  const selected = wrestlers.find((c) => c.id === selectedId) || wrestlers[0];
  const name = selected ? selected.name : "Open";
  const ovr = selected ? overallScore(selected).toFixed(1) : "--";
  const badges: string[] = [];
  if (selected && selected.injury && selected.injury.days > 0) badges.push(`${selected.injury.type} (${selected.injury.days}d)`);
  if (selected && selected.form) badges.push(`Form ${selected.form > 0 ? "+" : ""}${selected.form}`);
  if (selected && selected.fatigue && selected.fatigue > 70) badges.push(`Fatigue ${selected.fatigue}`);

  const select = document.createElement("select");
  const openOpt = document.createElement("option");
  openOpt.value = "";
  openOpt.textContent = "Open Slot";
  select.appendChild(openOpt);

  wrestlers
    .sort((a, b) => overallScore(b) - overallScore(a))
    .forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.name} (OVR ${overallScore(c).toFixed(1)})`;
      select.appendChild(opt);
    });

  select.value = selectedId || "";
  select.addEventListener("change", (e) => {
    const value = (e.target as HTMLSelectElement).value;
    onSelect(value || null);
  });

  card.innerHTML = `
    <h3>${weightClass} lbs</h3>
    <p class="name">${name}</p>
    <p class="meta">${selected ? `OVR ${ovr}` : "No wrestler"}</p>
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

  const selectWrap = document.createElement("div");
  selectWrap.className = "select";
  selectWrap.appendChild(select);
  card.appendChild(selectWrap);

  return card;
}

export function ensureLineupSelections(
  lineupSelections: Record<number, string | null>,
  roster: WrestlerCard[],
  weightClasses: number[] = WEIGHT_CLASSES
): void {
  for (const wc of weightClasses) {
    const selectedId = lineupSelections[wc];
    const exists = selectedId ? roster.some((w) => w.id === selectedId) : false;
    if (!exists) {
      const best = roster
        .filter((w) => w.weightClass === wc)
        .sort((a, b) => (a.id > b.id ? 1 : -1))[0];
      lineupSelections[wc] = best ? best.id : null;
    }
  }
}
