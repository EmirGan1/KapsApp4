import { createHash } from "node:crypto";
import { AI_IMAGE_BYTES, AI_IMAGE_EDGE } from "../shared/kapsAppAi";

const PREFIX = "data:image/jpeg;base64,";

// Validate the encoded JPEG and frame dimensions before sending it to Ollama.
// The browser also decodes and re-encodes photos, stripping metadata.
export function parseKapsAiImage(value: unknown) {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return null;
  const encoded = value.slice(PREFIX.length);
  if (!encoded.length || encoded.length > Math.ceil(AI_IMAGE_BYTES / 3) * 4
      || encoded.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length > AI_IMAGE_BYTES || bytes.length < 12 || bytes.toString("base64") !== encoded
      || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) return null;
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > bytes.length) return null;
    const size = bytes.readUInt16BE(offset);
    if (size < 2 || offset + size > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (size < 8) return null;
      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      if (!width || !height || width > AI_IMAGE_EDGE || height > AI_IMAGE_EDGE) return null;
      return { dataUrl: value, encoded, bytes, hash: createHash("sha256").update(bytes).digest("hex") };
    }
    offset += size;
  }
  return null;
}
