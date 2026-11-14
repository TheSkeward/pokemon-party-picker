// Node module-loader hook so the real app modules run under node --test:
// rewrites `import.meta.env`, which Vite defines and plain Node does not,
// to a global the harness sets. Imports resolve as Node resolves them, so
// a relative import without its extension fails here before it ships.

export async function load(url, context, next) {
  if (url.startsWith('file:') && url.endsWith('.js')) {
    const result = await next(url, context);
    const source = result.source?.toString() ?? '';
    if (source.includes('import.meta.env')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: source.replace(/import\.meta\.env\b/g, '(globalThis.__ENV__)'),
      };
    }
    return result;
  }
  return next(url, context);
}
