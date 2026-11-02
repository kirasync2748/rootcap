const MAX_TIMER_DELAY = 2_147_483_647;

/** Schedule expiry without overflowing the browser's maximum timer delay. */
export function scheduleExpiry(expires: number, onExpire: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    const delay = Math.min(Math.max(expires - Date.now(), 0), MAX_TIMER_DELAY);
    timer = setTimeout(() => {
      if (Date.now() >= expires) onExpire();
      else schedule();
    }, delay);
  };
  schedule();
  return () => clearTimeout(timer);
}
