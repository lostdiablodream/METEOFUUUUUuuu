// Обёртка над fetch: JSON, таймаут и объединённый AbortSignal.
export async function fetchJSON(url, { signal, timeout = 15000, ...options } = {}) {
  const signals = [signal, AbortSignal.timeout(timeout)].filter(Boolean);
  const combined = typeof AbortSignal.any === 'function' ? AbortSignal.any(signals) : signal;

  const response = await fetch(url, { ...options, signal: combined });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}
