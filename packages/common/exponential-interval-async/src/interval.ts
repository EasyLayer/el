type IntervalOptions = {
  interval: number; // initial interval
  multiplier: number; // step multiplier
  maxInterval: number; // maximum interval
  maxAttempts?: number; // number of attempts (infinite by default)
};

export type ExponentialTimer = {
  destroy: () => void;
};

export const exponentialIntervalAsync = (
  asyncFunction: (resetInterval: () => void) => Promise<void>,
  options: IntervalOptions
): ExponentialTimer => {
  const { interval, multiplier, maxAttempts = Infinity, maxInterval } = options;

  if (maxInterval < interval) {
    throw new Error('maxInterval cannot be less than initial interval');
  }

  let attemptCount = 0;
  let currentInterval = interval;
  let stopped = false;
  let timeoutId: NodeJS.Timeout;

  const resetInterval = () => {
    currentInterval = interval;
    attemptCount = 0;
  };

  const scheduler = async () => {
    if (stopped) return;

    if (attemptCount >= maxAttempts) {
      return;
    }

    await asyncFunction(resetInterval);

    if (attemptCount < maxAttempts) {
      attemptCount++;
    }

    // Increase the interval taking into account the maximum value
    currentInterval = Math.min(currentInterval * multiplier, maxInterval);

    // Schedule next call
    timeoutId = setTimeout(scheduler, currentInterval);
  };

  // First call to the scheduler
  timeoutId = setTimeout(scheduler, currentInterval);

  // Return the control object
  return {
    destroy: () => {
      stopped = true;
      clearTimeout(timeoutId);
    },
  };
};
