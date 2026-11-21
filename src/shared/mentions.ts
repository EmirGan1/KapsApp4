export type MentionKind = 'global' | 'group' | 'dm' | 'post';
export const canMentionEveryone = (username: string) => username.trim().toLowerCase() === 'emirgan';
export function containsMention(text: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[\\s(])@${escaped}(?=$|[\\s.,!?;:()])`, 'iu').test(text);
}
