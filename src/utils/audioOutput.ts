export type RoutableAudio = HTMLMediaElement & { setSinkId?: (id: string) => Promise<void>; sinkId?: string };
export async function applyAudioOutput(elements: RoutableAudio[], id: string) {
  if (!elements.length || elements.some(el => typeof el.setSinkId !== 'function')) throw new Error('Ses çıkışı seçimi bu tarayıcıda desteklenmiyor. Telefonun sistem ses çıkışı menüsünü kullanın.');
  const previous = elements.map(el => el.sinkId || '');
  try {
    for (const el of elements) {
      await el.setSinkId!(id);
      if (el.sinkId !== id) throw new Error('Ses çıkışı doğrulanamadı.');
    }
  } catch (error) {
    await Promise.allSettled(elements.map((el, index) => el.setSinkId!(previous[index])));
    throw error;
  }
}
