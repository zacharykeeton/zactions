/**
 * Reliable completion sound playback using the Web Audio API.
 *
 * HTMLAudioElement is unreliable for short UI feedback sounds because:
 * - play() can silently fail if the element is still loading/buffering
 * - Resetting currentTime + play() races with the browser's internal state
 * - Per-component Audio instances get re-created on React re-renders
 *
 * The Web Audio API avoids all of this: we decode the file once into an
 * AudioBuffer, then create a disposable AudioBufferSourceNode per play.
 * Source nodes are dirt-cheap and playback is instantaneous.
 */

const SOUND_URL = "/sounds/liecio-bonus-points-190035.mp3";

let audioCtx: AudioContext | null = null;
let bufferPromise: Promise<AudioBuffer> | null = null;

function getContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function loadBuffer(): Promise<AudioBuffer> {
  if (!bufferPromise) {
    bufferPromise = fetch(SOUND_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch sound: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => getContext().decodeAudioData(data))
      .catch((err) => {
        // Allow retry on next call
        bufferPromise = null;
        throw err;
      });
  }
  return bufferPromise;
}

/**
 * Eagerly fetch + decode the sound so it's ready before the first click.
 * Safe to call multiple times — only the first call does real work.
 */
export function preloadCompletionSound(): void {
  if (typeof window === "undefined") return;
  loadBuffer().catch(() => {
    /* swallow — will retry on play */
  });
}

/**
 * Play the completion sound. Guaranteed to play on every call as long as
 * the browser has received at least one prior user gesture (which is always
 * the case here since this fires from a checkbox click).
 */
export async function playCompletionSound(): Promise<void> {
  if (typeof window === "undefined") return;

  const ctx = getContext();

  // Resume the context if it was suspended (browsers suspend AudioContext
  // until a user gesture — the checkbox click satisfies this).
  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const buffer = await loadBuffer();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
}
