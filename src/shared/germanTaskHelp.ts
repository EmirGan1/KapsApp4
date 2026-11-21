/** Optional aids may pronounce already-visible source text, never the hidden answer. */
export function taskHelpPolicy(task: {
  type?: string; objective?: string; direction?: string; prompt?: string; passage?: string;
  audioText?: string; interaction?: { audioText?: string; wordMeta?: { de?: string } };
} | undefined, reviewed: boolean) {
  if (!task) return { wordPronunciation: false, audioText: undefined as string | undefined };
  const word = task.interaction?.wordMeta?.de;
  const audio = task.interaction?.audioText || task.audioText || word;
  if (reviewed) return { wordPronunciation: true, audioText: audio };
  // These objectives would disclose an article, a missing form, or the model answer.
  if (['article', 'conjugation', 'gap', 'sentence_gap', 'sentence_completion', 'ordering', 'sentence_ordering', 'spelling', 'missing', 'correction', 'satzbau', 'listening'].includes(task.type || '') ||
      ['article', 'conjugation', 'production', 'spelling', 'ordering'].includes(task.objective || '')) {
    return { wordPronunciation: false, audioText: undefined };
  }
  const visible = `${task.prompt || ''} ${task.passage || ''}`.normalize('NFC').toLocaleLowerCase('de');
  const isVisible = (text?: string) => !!text && visible.includes(text.normalize('NFC').toLocaleLowerCase('de'));
  const sourceIsGerman = task.direction === 'de_tr';
  return { wordPronunciation: sourceIsGerman && isVisible(word), audioText: sourceIsGerman && isVisible(audio) ? audio : undefined };
}
