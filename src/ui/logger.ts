// Logger for UI output
export function logToElement(target: HTMLElement | null | undefined, message: string): void {
  if (!target) return;
  target.textContent = message;
}
