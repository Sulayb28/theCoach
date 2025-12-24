// Save/load functionality
export interface SavedState<
  TWrestler = unknown,
  TProspect = unknown,
  TDual = unknown,
  TLeague = unknown,
  TLive = unknown
> {
  roster: TWrestler[];
  teamName?: string;
  dayOfWeek?: number;
  seasonWeek?: number;
  seasonWins?: number;
  seasonLosses?: number;
  lineupSelections?: Record<number, string | null>;
  recruits?: TProspect[];
  shortlist?: TProspect[];
  programId?: string;
  budget?: number;
  nilBudget?: number;
  committedThisSeason?: number;
  weeklySummaries?: string[];
  league?: TLeague[];
  postseasonLog?: string;
  postseasonBracket?: { semifinal1?: TDual; semifinal2?: TDual; final?: TDual };
  signedRecruits?: TProspect[];
  prestige?: number;
  postseasonPlayed?: boolean;
  liveDualState?: TLive;
}

export function saveState(key: string, state: SavedState, onMessage?: (msg: string) => void): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
    onMessage?.("Roster saved.");
  } catch (err) {
    console.error(err);
    onMessage?.("Error saving roster.");
  }
}

export function loadState<T extends SavedState>(
  key: string,
  legacyKey?: string,
  onMessage?: (msg: string) => void
): T | null {
  let raw = localStorage.getItem(key);
  if (!raw && legacyKey) {
    raw = localStorage.getItem(legacyKey);
  }
  if (!raw) {
    onMessage?.("No saved roster found.");
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(err);
    onMessage?.("Error loading roster.");
    return null;
  }
}
