export type ResetTicket = { username: string; requesterKey: string };
const storageKey = (username: string) => `kaps_reset:${username.trim().toLowerCase()}`;
export function readResetTicket(username: string): ResetTicket | null {
  try {
    const ticket = JSON.parse(localStorage.getItem(storageKey(username)) || 'null');
    return ticket && ticket.username.toLowerCase() === username.trim().toLowerCase() && /^[a-f0-9]{64}$/.test(ticket.requesterKey) ? ticket : null;
  } catch { return null; }
}
export function createResetTicket(username: string): ResetTicket {
  const existing = readResetTicket(username);
  if (existing) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const ticket = { username: username.trim(), requesterKey: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') };
  // Store before the request so reloads and a lost response cannot lose ownership.
  localStorage.setItem(storageKey(username), JSON.stringify(ticket));
  return ticket;
}
export function clearResetTicket(username: string) { localStorage.removeItem(storageKey(username)); }
