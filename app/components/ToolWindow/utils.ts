// Shared utility functions for ToolWindow components

/**
 * Format glob/grep title: pattern + path + include
 */
export function formatGlobToolTitle(input: Record<string, unknown> | undefined): string | undefined {
  const pattern = typeof input?.pattern === 'string' ? input.pattern.trim() : '';
  const path = typeof input?.path === 'string' ? input.path.trim() : '';
  const include = typeof input?.include === 'string' ? input.include.trim() : '';
  const segments: string[] = [];
  if (pattern) segments.push(pattern);
  if (path) segments.push(`@ ${path}`);
  if (include) segments.push(`include ${include}`);
  const title = segments.join(' ');
  return title || undefined;
}

/**
 * Format read-like title: filePath → path
 */
export function formatReadLikeToolTitle(input: Record<string, unknown> | undefined): string | undefined {
  const filePath = typeof input?.filePath === 'string' ? input.filePath.trim() : '';
  if (filePath) return filePath;
  const path = typeof input?.path === 'string' ? input.path.trim() : '';
  return path || undefined;
}

/**
 * Resolve read/write path from multiple sources
 */
export function resolveReadWritePath(
  input: Record<string, unknown> | undefined,
  metadata: Record<string, unknown> | undefined,
  state: Record<string, unknown> | undefined,
): string | undefined {
  const filePath = typeof input?.filePath === 'string' ? input.filePath.trim() : '';
  if (filePath) return filePath;
  const path = typeof input?.path === 'string' ? input.path.trim() : '';
  if (path) return path;
  const metadataPath = typeof metadata?.filepath === 'string' ? metadata.filepath.trim() : '';
  if (metadataPath) return metadataPath;
  const title = typeof state?.title === 'string' ? state.title.trim() : '';
  return title || undefined;
}

/**
 * Resolve read range: offset and limit
 */
export function resolveReadRange(input: Record<string, unknown> | undefined): { offset?: number; limit?: number } {
  const offsetValue = input?.offset;
  const limitValue = input?.limit;
  const offset =
    typeof offsetValue === 'number' && Number.isFinite(offsetValue) && offsetValue >= 0
      ? Math.floor(offsetValue)
      : undefined;
  const limit =
    typeof limitValue === 'number' && Number.isFinite(limitValue) && limitValue > 0
      ? Math.floor(limitValue)
      : undefined;
  return { offset, limit };
}

/**
 * Format list title: path
 */
export function formatListToolTitle(input: Record<string, unknown> | undefined): string | undefined {
  const path = typeof input?.path === 'string' ? input.path.trim() : '';
  return path || undefined;
}

/**
 * Format webfetch title: url
 */
export function formatWebfetchToolTitle(input: Record<string, unknown> | undefined): string | undefined {
  const url = typeof input?.url === 'string' ? input.url.trim() : '';
  return url || undefined;
}

/**
 * Format query title: query
 */
export function formatQueryToolTitle(input: Record<string, unknown> | undefined): string | undefined {
  const query = typeof input?.query === 'string' ? input.query.trim() : '';
  return query || undefined;
}
