import { type Label } from '@reedito/admin-x-framework/api/labels';

export function canCreateLabel(labels: Label[], query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return !labels.some((label) => label.name.toLowerCase() === normalized);
}
