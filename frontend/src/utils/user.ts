import type { User } from '../types';

export function getDisplayName(
  user: User | { username: string; nickname?: string | null },
): string {
  return user.nickname || user.username;
}
