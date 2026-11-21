export interface WordMeaning { token: string; meaningTr: string | null; noteTr?: string; }
export interface QuestionWord extends WordMeaning { locked: boolean; }
export const wordKey = (text: string) => text.normalize('NFC').toLocaleLowerCase('de');
export function germanTokens(text: string): string[] {
  return text.match(/[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*|\d+(?:[.,]\d+)?/gu) || [];
}
