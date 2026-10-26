export async function fetchWorkspace(url: string, signal?: AbortSignal, timeoutMs = 20_000) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => {
      controller.abort();
      reject(new DOMException('Workspace request canceled', 'AbortError'));
    };
    if (signal?.aborted) { onAbort(); return; }
    signal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Tải dữ liệu quá lâu. Vui lòng thử tải lại.'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      interrupted,
      (async () => {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        const payload = await response.json();
        return { response, payload };
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    if (onAbort) signal?.removeEventListener('abort', onAbort);
  }
}
