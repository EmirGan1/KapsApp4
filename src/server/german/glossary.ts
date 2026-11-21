import { germanTokens, wordKey, type WordMeaning, type QuestionWord } from '../../shared/germanGlossary';
import type { Task, Vocabulary } from './learning';

const BASICS: Record<string, string> = {
  ich:'ben', du:'sen', er:'o (erkek)', sie:'o / onlar / siz (bağlama göre)', es:'o', wir:'biz', ihr:'siz / onun (bağlama göre)',
  mich:'beni / kendimi', dich:'seni / kendini', sich:'kendini / birbirini', mir:'bana', dir:'sana', uns:'bizi / bize', ihnen:'onlara',
  mein:'benim', meine:'benim', dein:'senin', seine:'onun', ihre:'onun / onların', unser:'bizim',
  der:'belirli artikel', die:'belirli artikel', das:'belirli artikel', den:'belirli artikel (çekimli)', dem:'belirli artikel (çekimli)',
  ein:'bir', eine:'bir', einen:'bir', einem:'bir', einer:'bir', kein:'hiç / bir ... değil', keine:'hiç / ... değil', keinen:'hiç / ... değil',
  und:'ve', oder:'veya', aber:'ama', denn:'çünkü', weil:'çünkü', dass:'-dığını / -diğini', wenn:'eğer / -dığında', obwohl:'-mesine rağmen',
  nicht:'değil / -me olumsuzluğu', auch:'de / da', nur:'sadece', sehr:'çok', schon:'çoktan / zaten', noch:'hâlâ / henüz', wieder:'yeniden',
  heute:'bugün', morgen:'yarın / sabah', gestern:'dün', jetzt:'şimdi', immer:'her zaman', oft:'sık sık', manchmal:'bazen', nie:'asla',
  hier:'burada', dort:'orada', zusammen:'birlikte', gern:'severek / memnuniyetle', gerne:'severek / memnuniyetle',
  in:'içinde / -de', im:'içinde / -de (in dem)', am:'-de / -da (an dem)', an:'yanında / üzerinde / -e (bağlama göre)',
  auf:'üstünde / üzerine', mit:'ile', ohne:'olmadan', für:'için', von:'-den / -dan', zu:'-e / -a', zum:'-e / -a (zu dem)', zur:'-e / -a (zu der)',
  nach:'sonra / -e doğru', aus:'-den / -dan (içinden)', bei:'yanında / -de', über:'üzerinde / hakkında', vor:'önünde / önce', unter:'altında', um:'saat ... / etrafında',
  was:'ne', wer:'kim', wo:'nerede', wohin:'nereye', wann:'ne zaman', warum:'neden', wie:'nasıl',
  bin:'-im (sein)', bist:'-sin (sein)', ist:'-dir (sein)', sind:'-iz / -ler (sein)', seid:'-siniz (sein)',
  habe:'sahibim / yardımcı fiil', hast:'sahipsin / yardımcı fiil', hat:'sahip / yardımcı fiil', haben:'sahip olmak / yardımcı fiil',
  kann:'yapabilir / -ebilir', muss:'zorunda / -meli', möchte:'ister / istiyorum', will:'ister / istiyorum', wird:'olacak / yardımcı fiil',
  bitte:'lütfen / buyurun', danke:'teşekkürler', ja:'evet', nein:'hayır', gut:'iyi', mehr:'daha fazla', viel:'çok', viele:'çok sayıda',
  '0':'sıfır','1':'bir','2':'iki','3':'üç','4':'dört','5':'beş','6':'altı','7':'yedi','8':'sekiz','9':'dokuz','10':'on',
};
export function wordDictionary(words: Vocabulary[]) {
  const map = new Map<string, string>(Object.entries(BASICS));
  for (const word of words) {
    const bare = word.de.replace(/^(der|die|das)\s+/iu, '').trim();
    if (germanTokens(bare).length === 1) {
      map.set(wordKey(bare), word.tr);
      const plural = word.plural?.replace(/^(der|die|das)\s+/iu, '').trim();
      if (plural && germanTokens(plural).length === 1) map.set(wordKey(plural), `${word.tr} (çoğul)`);
      if (word.conjugation?.answer && germanTokens(word.conjugation.answer).length === 1)
        map.set(wordKey(word.conjugation.answer), `${word.tr} (çekimli fiil; bağlama göre)`);
    }
  }
  return map;
}
export function germanStudyText(task: Task): string {
  if (task.sentenceDe) return task.sentenceDe;
  const quoted = task.prompt.match(/[“„"]([^”"]+)[”"]/u)?.[1];
  if (task.type === 'listening') return task.interaction?.audioText || task.audioText || task.interaction?.wordMeta?.de || '';
  if (['ordering','sentence_ordering','satzbau'].includes(task.type)) return task.answer;
  if (task.type === 'sentence_translation') return task.direction === 'de_tr' ? quoted || task.prompt : task.answer;
  if (['gap','sentence_gap','sentence_completion','conjugation'].includes(task.type)) return task.prompt.replace(/_{2,}/u, task.answer).replace(/\s*\([^()]+\)\s*$/u, '');
  if (task.type === 'matching') {
    let paired: string[] = []; try { paired = JSON.parse(task.answer); } catch {}
    return (task.direction === 'tr_de' ? paired : task.interaction?.left)?.join(' · ') || '';
  }
  return task.interaction?.wordMeta?.de || (task.direction === 'de_tr' ? quoted || task.prompt : task.answer);
}
export function turkishStudyText(task: Task, word?: Vocabulary | null) {
  if (task.sentenceTr) return task.sentenceTr;
  if (task.turkishPromptSentence) return task.turkishPromptSentence;
  if (task.type === 'sentence_translation') return task.direction === 'de_tr' ? task.answer : task.prompt.match(/[“„"]([^”"]+)[”"]/u)?.[1] || '';
  if (task.type === 'listening') return task.answer;
  if (['gap','sentence_gap','sentence_completion'].includes(task.type) && task.passage) return task.passage;
  if (['ordering','sentence_ordering'].includes(task.type)) return task.prompt.match(/[“„"]([^”"]+)[”"]/u)?.[1] || task.passage || '';
  if (task.type === 'conjugation') {
    const source = germanStudyText(task).replace(/[\p{P}\p{S}\s]/gu, '').toLocaleLowerCase('de');
    const example = word?.exampleDe || task.interaction?.wordMeta?.exampleDe || '';
    return source === example.replace(/[\p{P}\p{S}\s]/gu, '').toLocaleLowerCase('de') ? word?.exampleTr || task.interaction?.wordMeta?.exampleTr || '' : '';
  }
  if (task.type === 'matching') {
    let paired: string[] = []; try { paired = JSON.parse(task.answer); } catch {}
    return (task.direction === 'tr_de' ? task.interaction?.left : paired)?.join(' · ') || '';
  }
  return word?.tr || task.interaction?.wordMeta?.tr || '';
}
export function completeWordMeanings(text: string, raw: unknown, words: Vocabulary[]): WordMeaning[] {
  const dictionary = wordDictionary(words);
  const supplied = new Map<string, WordMeaning>();
  if (Array.isArray(raw)) for (const value of raw.slice(0, 250)) {
    if (typeof value?.token !== 'string' || typeof value.meaningTr !== 'string' || !value.meaningTr.trim()) continue;
    supplied.set(wordKey(value.token), { token: value.token, meaningTr: value.meaningTr.trim().slice(0, 220),
      noteTr: typeof value.noteTr === 'string' ? value.noteTr.trim().slice(0, 260) : undefined });
  }
  return germanTokens(text).map((token, index) => {
    const at = Array.isArray(raw) ? raw[index] : null;
    const contextual = at && typeof at.token === 'string' && wordKey(at.token) === wordKey(token) && typeof at.meaningTr === 'string' && at.meaningTr.trim() ? at : supplied.get(wordKey(token));
    return { token, meaningTr: contextual?.meaningTr?.trim().slice(0, 220) || dictionary.get(wordKey(token)) || null,
      noteTr: typeof contextual?.noteTr === 'string' ? contextual.noteTr.trim().slice(0, 260) : undefined };
  });
}
export function questionWords(task: Task, words: Vocabulary[], reviewed: boolean): QuestionWord[] {
  const text = germanStudyText(task);
  const visible = new Set(germanTokens([task.prompt, task.passage, ...(task.interaction?.tiles || []), ...(task.interaction?.left || []), ...(task.interaction?.right || []), task.flawedSentenceDe || ''].join(' ')).map(wordKey));
  const secrets = new Set(germanTokens([task.answer, ...task.alternatives, task.type === 'article' ? '' : task.interaction?.wordMeta?.de || ''].join(' ')).map(wordKey));
  const comprehension = ['choice','multiple_choice','translation','translation_de_tr','translation_tr_de','sentence_translation','matching','listening','multi','true_false','intruder'].includes(task.type);
  const used = new Set<string>();
  return completeWordMeanings(text, [], words).filter(word => {
    const key = wordKey(word.token);
    if (used.has(key) || (!reviewed && !visible.has(key))) return false;
    used.add(key); return true;
  }).map(word => {
    const locked = !reviewed && (comprehension || secrets.has(wordKey(word.token)));
    return { token: word.token, meaningTr: locked ? null : word.meaningTr, locked };
  });
}
