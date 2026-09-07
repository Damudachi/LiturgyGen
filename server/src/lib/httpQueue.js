/**
 * A single global outbound-request queue.
 *
 * Every scrape in LiturgyGen goes through here. Batch generation walks 20-30
 * dates, and firing those in parallel is precisely what gets an office IP
 * challenged or blocked. One request at a time, spaced by a floor delay.
 */

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class RequestQueue {
  #tail = Promise.resolve();

  #lastStartedAt = 0;

  #pending = 0;

  constructor({ minDelayMs = 800, name = 'http' } = {}) {
    this.minDelayMs = minDelayMs;
    this.name = name;
  }

  get pending() {
    return this.#pending;
  }

  /** Run `task` after the queue drains and the minimum spacing has elapsed. */
  add(task) {
    this.#pending += 1;
    const run = this.#tail.then(async () => {
      const waitFor = this.minDelayMs - (Date.now() - this.#lastStartedAt);
      if (waitFor > 0) await sleep(waitFor);
      this.#lastStartedAt = Date.now();
      try {
        return await task();
      } finally {
        this.#pending -= 1;
      }
    });
    // Swallow rejections on the chain itself so one failure cannot stall the queue.
    this.#tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** Pause the queue for `ms` before the next task starts - used after a 429. */
  backOff(ms) {
    this.#lastStartedAt = Date.now() + ms - this.minDelayMs;
  }
}

export default RequestQueue;
