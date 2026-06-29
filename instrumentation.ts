export async function register() {
  // Only run in the Node.js runtime (not edge), once on server startup
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  try {
    const { warmUpListValues } = await import('./lib/warmup');
    await warmUpListValues();
  } catch (err) {
    // Warm-up is best-effort — never crash the server
    console.warn('[instrumentation] list-values warm-up failed:', err instanceof Error ? err.message : err);
  }
}
