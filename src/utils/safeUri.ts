/**
 * Güvenli URI Çözümleme Yardımcısı
 * URIError: URI malformed hatalarını yakalar ve uygulamanın çökmesini engeller.
 */
export const safeDecodeURI = (str: string): string => {
  if (!str) return '';
  try {
    return decodeURIComponent(str);
  } catch (err) {
    // Malformed URI durumunda (örn: /dersler/% veya bozuk karakter kodlaması)
    // string'i temizlemeyi dener veya ham haliyle döndürür
    try {
      // Yalnızca tek başına duran % işaretlerini encode ederek kurtarmayı dene
      const cleaned = str.replace(/%(?![0-9A-Fa-f]{2})/g, '%25');
      return decodeURIComponent(cleaned);
    } catch {
      return str;
    }
  }
};

export default safeDecodeURI;
