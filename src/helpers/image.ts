import { decodeHTMLStrict } from 'entities';
import sharp from 'sharp';

export const RESIZE_FITS = ['cover', 'contain', 'fill', 'inside', 'outside'];

function isUndefinedEntityError(err: unknown): boolean {
  return err instanceof Error && /Entity '[^']+' not defined/.test(err.message);
}

const XML_ENTITY_NAMES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);
const SKIPPED_SECTIONS = '<!--[\\s\\S]*?-->|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|<\\?[\\s\\S]*?\\?>';
const SKIPPED = new RegExp(SKIPPED_SECTIONS, 'g');
const ENTITY_OR_SKIPPED = new RegExp(`${SKIPPED_SECTIONS}|&([A-Za-z][A-Za-z0-9]{0,31});`, 'g');

export function numericizeHtmlEntities(svg: string): string {
  const declared = new Set(
    [...svg.replace(SKIPPED, '').matchAll(/<!ENTITY\s+([A-Za-z][A-Za-z0-9]*)\s/g)].map(
      match => match[1]
    )
  );

  return svg.replace(ENTITY_OR_SKIPPED, (match, name?: string) => {
    if (name === undefined || XML_ENTITY_NAMES.has(name) || declared.has(name)) return match;

    const decoded = decodeHTMLStrict(match);
    if (decoded === match) return match;

    return [...decoded].map(character => `&#${character.codePointAt(0)};`).join('');
  });
}

function toWebp(input, w, h, options?): Promise<Buffer> {
  return sharp(input).resize(w, h, options).webp().toBuffer();
}

export async function resize(input: Buffer, w, h, options?): Promise<Buffer> {
  try {
    return await toWebp(input, w, h, options);
  } catch (err) {
    if (!isUndefinedEntityError(err)) throw err;

    const svg = input.toString('latin1');
    const rewritten = numericizeHtmlEntities(svg);
    if (rewritten === svg) throw err;

    try {
      return await toWebp(Buffer.from(rewritten, 'latin1'), w, h, options);
    } catch (retryErr) {
      (err as Error).cause = retryErr;
      throw err;
    }
  }
}
