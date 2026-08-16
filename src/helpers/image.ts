import { decodeHTMLStrict } from 'entities';
import sharp from 'sharp';

export const RESIZE_FITS = ['cover', 'contain', 'fill', 'inside', 'outside'];

function isUndefinedEntityError(err: unknown): boolean {
  return err instanceof Error && /Entity '[^']+' not defined/.test(err.message);
}

// XML defines these five itself, so they are never the name the parser
// rejected. Decoding them would edit a part of the document that was not
// broken, and turn escaped text back into markup on the way out.
const XML_ENTITY_NAMES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

// Sections where a name is literal text rather than a reference: comments,
// CDATA, and processing instructions, which librsvg does act on. Held as a
// source string so the declaration scan and the rewrite skip the same things;
// a declaration quoted inside one of these is not a declaration.
const SKIPPED_SECTIONS = '<!--[\\s\\S]*?-->|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|<\\?[\\s\\S]*?\\?>';

const SKIPPED = new RegExp(SKIPPED_SECTIONS, 'g');
const ENTITY_OR_SKIPPED = new RegExp(`${SKIPPED_SECTIONS}|&([A-Za-z][A-Za-z0-9]{0,31});`, 'g');

// An SVG naming any other entity needs an HTML DTD that libvips' XML parser
// never loads, so browsers render the file and sharp rejects the whole
// document. Rewriting the name to its numeric form is what makes it parse.
// A name the document declares for itself already resolves, so it is left
// alone too.
//
// Exported for the tests: which names this rewrites, and to what, is not
// observable through resize(), which renders a missing glyph and a wrong one
// identically.
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

    // latin1 is the byte to char map, so this round trip is lossless whatever
    // the document is encoded as. utf8 would replace every byte it cannot
    // decode, and the retry would then render mojibake rather than fail.
    const svg = input.toString('latin1');
    const rewritten = numericizeHtmlEntities(svg);
    if (rewritten === svg) throw err;

    try {
      return await toWebp(Buffer.from(rewritten, 'latin1'), w, h, options);
    } catch (retryErr) {
      // The retry parses a document we synthesised, so its error names an
      // entity the caller never sent. Report the one describing their input,
      // with the retry's failure attached as cause so it is not lost.
      (err as Error).cause = retryErr;
      throw err;
    }
  }
}
