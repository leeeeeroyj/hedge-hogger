// The high score: one number in localStorage under HI_STORAGE, which Arcadia's cabinet shows too. Storage can be
// blocked (private windows, embeds), so every access is in try/catch and the game carries on without it.
import { ATTRACT } from './attract';
import { HI_STORAGE } from './config';

export function loadHi() {
  try {
    return Math.max(0, Number(localStorage.getItem(HI_STORAGE)) || 0);
  } catch {
    return 0;
  }
}

/** Saves `hi` if it beats the stored one. Attract mode never writes. */
export function saveHi(hi: number) {
  if (ATTRACT) return;
  try {
    if (hi > loadHi()) localStorage.setItem(HI_STORAGE, String(hi));
  } catch {
    // Blocked or full: this session just won't remember it.
  }
}
