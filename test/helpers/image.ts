import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';

export const REFERENCE_DIR = join(__dirname, '..', 'fixtures', 'images');

export function referencePath(resolver: string, address: string): string {
  return join(REFERENCE_DIR, resolver, `${address}.png`);
}

// Decode any sharp-readable image buffer (webp/png/...) into a flattened raw
// RGBA bitmap plus its dimensions, so two encodings can be compared pixel wise.
export async function toRgba(
  input: Buffer
): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// Persist a resolver output as a canonical PNG reference (decoded then
// re-encoded so the committed bytes are deterministic and diffable).
export async function writeReference(
  resolver: string,
  address: string,
  output: Buffer
): Promise<string> {
  const path = referencePath(resolver, address);
  mkdirSync(dirname(path), { recursive: true });
  const png = await sharp(output).png().toBuffer();
  writeFileSync(path, png);
  return path;
}
