import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { numericizeHtmlEntities, resize } from '../../../src/helpers/image';

const MAX = 500;

const AVATAR_FIXTURE = path.resolve(__dirname, '../../fixtures/ens-avatar-html-entities.svg');

function svg(body: string): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">${body}</svg>`,
    'utf8'
  );
}

// What resize() did before the entity retry existed, and still has to do for
// every input that parses on the first attempt.
function directPipeline(input: Buffer): Promise<Buffer> {
  return sharp(input).resize(MAX, MAX).webp().toBuffer();
}

// resize() cannot tell these apart: libvips draws a wrong code point and a
// missing glyph the same way, and on a runner with no text font it draws every
// code point the same way. They are pinned on the string instead.
describe('numericizeHtmlEntities', () => {
  it('rewrites names to the code points browsers use', () => {
    expect(numericizeHtmlEntities('&copy;&eacute;&alpha;&mdash;')).toBe(
      '&#169;&#233;&#945;&#8212;'
    );
    // One name HTML 4.01 never had, and one whose 4.01 code point is not the
    // one browsers draw. Both come from the WHATWG table rather than a list
    // maintained here.
    expect(numericizeHtmlEntities('&colon;&lang;')).toBe('&#58;&#10216;');
    expect(numericizeHtmlEntities('&NotEqualTilde;')).toBe('&#8770;&#824;');
  });

  it('leaves the names XML defines alone', () => {
    expect(numericizeHtmlEntities('&amp;&lt;&gt;&quot;&apos;&nbsp;')).toBe(
      '&amp;&lt;&gt;&quot;&apos;&#160;'
    );
  });

  it('leaves comments, CDATA, processing instructions and declarations alone', () => {
    expect(numericizeHtmlEntities('<!-- &copy; -->&nbsp;')).toBe('<!-- &copy; -->&#160;');
    expect(numericizeHtmlEntities('<![CDATA[&copy;]]>&nbsp;')).toBe('<![CDATA[&copy;]]>&#160;');
    expect(numericizeHtmlEntities('<?xml-stylesheet href="a&copy;b"?>&nbsp;')).toBe(
      '<?xml-stylesheet href="a&copy;b"?>&#160;'
    );
    // The declared name has to collide with a real one for this to mean
    // anything: an unknown name is left alone by the decoder either way.
    expect(numericizeHtmlEntities('<!ENTITY copy "x"> &copy; &nbsp;')).toBe(
      '<!ENTITY copy "x"> &copy; &#160;'
    );
  });

  // A declaration quoted inside a skipped section is not a declaration, so it
  // must not stop the rewrite. This is the whole fix being one skip rather
  // than the scan having its own.
  it('ignores a declaration quoted inside a skipped section', () => {
    expect(numericizeHtmlEntities('<!-- <!ENTITY nbsp "x"> -->&nbsp;')).toBe(
      '<!-- <!ENTITY nbsp "x"> -->&#160;'
    );
    expect(numericizeHtmlEntities('<![CDATA[<!ENTITY nbsp "x">]]>&nbsp;')).toBe(
      '<![CDATA[<!ENTITY nbsp "x">]]>&#160;'
    );
  });

  it('leaves a name it cannot resolve alone', () => {
    expect(numericizeHtmlEntities('&notarealentity;')).toBe('&notarealentity;');
    expect(numericizeHtmlEntities('&copy')).toBe('&copy');
  });

  // The byte half of what resize() relies on, pinned here because the render
  // half below only shows it where a text font is installed.
  it('carries non-ASCII bytes through a latin1 round trip', () => {
    const input = Buffer.from('caf\xE9&nbsp;', 'latin1');

    const output = Buffer.from(numericizeHtmlEntities(input.toString('latin1')), 'latin1');

    expect(output.equals(Buffer.from('caf\xE9&#160;', 'latin1'))).toBe(true);
  });
});

describe('resize', () => {
  describe('SVG using HTML named entities', () => {
    it('renders the ENS avatar that sharp rejects on its own', async () => {
      const input = fs.readFileSync(AVATAR_FIXTURE);
      expect(input.toString('utf8')).toContain('&nbsp;');
      await expect(directPipeline(input)).rejects.toThrow(/Entity 'nbsp' not defined/);

      const metadata = await sharp(await resize(input, MAX, MAX)).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.width).toBe(MAX);
      expect(metadata.height).toBe(MAX);
    });

    // libxml2 honours the prolog, so the retry has to hand back the bytes it
    // was given. Decoding as utf8 turns the raw 0xE9 into U+FFFD, and the
    // document then renders, wrongly, instead of failing.
    it('keeps the bytes of a document that is not UTF-8', async () => {
      const latin1 = (nbsp: string) =>
        Buffer.from(
          `<?xml version="1.0" encoding="ISO-8859-1"?>` +
            `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">` +
            `<text y="20">caf\xE9${nbsp}</text></svg>`,
          'latin1'
        );

      const output = await resize(latin1('&nbsp;'), MAX, MAX);

      expect(output.equals(await resize(latin1('&#160;'), MAX, MAX))).toBe(true);
    });

    // The comparison above only bites where a text font is installed. This one
    // holds anywhere: the byte is undecodable as utf8, so decoding it that way
    // would substitute U+FFFD, and a document nobody can read would come back
    // renderable and get cached. Refusing it is the correct answer.
    it('does not repair bytes it cannot decode', async () => {
      const undecodable = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">` +
          `<text y="20">caf\xE9&nbsp;</text></svg>`,
        'latin1'
      );

      await expect(resize(undecodable, MAX, MAX)).rejects.toThrow(/Entity 'nbsp' not defined/);
    });

    // api.ts resizes covers with a fit option, and that call is the one an
    // entity SVG cover reaches, so the retry has to carry the options through.
    it('applies the caller options to the retry', async () => {
      const contain = await resize(svg('<text y="20">&nbsp;wide</text>'), 200, 60, {
        fit: 'contain'
      });

      expect(
        contain.equals(
          await resize(svg('<text y="20">&#160;wide</text>'), 200, 60, { fit: 'contain' })
        )
      ).toBe(true);
      expect(
        contain.equals(
          await resize(svg('<text y="20">&#160;wide</text>'), 200, 60, { fit: 'cover' })
        )
      ).toBe(false);
    });
  });

  describe('errors', () => {
    // libxml2 reports the last undefined entity, so the original error names
    // nbsp and the retry's names notarealentity. Asserting on nbsp is what
    // separates "rethrew the original" from "rethrew the retry's".
    it('rethrows the original error when the retry also fails', async () => {
      const input = svg('<text y="20">&notarealentity;&nbsp;</text>');

      await expect(directPipeline(input)).rejects.toThrow(/Entity 'nbsp' not defined/);
      await expect(resize(input, MAX, MAX)).rejects.toThrow(/Entity 'nbsp' not defined/);
      await expect(resize(input, MAX, MAX)).rejects.not.toThrow(/notarealentity/);
    });

    // Here the rewrite works and the retry dies of something else entirely.
    // Reporting only the entity would point Sentry at a settled problem.
    it('attaches the retry failure as the cause', async () => {
      const huge = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100000" height="100000">' +
          '<text y="20">&nbsp;</text></svg>',
        'utf8'
      );

      const err = await resize(huge, MAX, MAX).catch(caught => caught);

      expect(err.message).toMatch(/Entity 'nbsp' not defined/);
      expect((err.cause as Error).message).toMatch(/exceeds pixel limit/);
    });

    // An absent cause is what says the retry never ran: once it runs and
    // fails, the test above shows the failure gets attached.
    it('does not retry when there is no entity it can rewrite', async () => {
      const err = await resize(svg('<text y="20">&notarealentity;</text>'), MAX, MAX).catch(
        caught => caught
      );

      expect(err.message).toMatch(/Entity 'notarealentity' not defined/);
      expect(err.cause).toBeUndefined();
    });

    // The entity name is here so that the rewrite would change the buffer if
    // this ever reached it. Only the gate stops it, so only the gate can keep
    // the cause absent.
    it('does not retry an error that is not about an entity', async () => {
      const err = await resize(Buffer.from('not an image at all &copy;'), MAX, MAX).catch(
        caught => caught
      );

      expect(err.message).toMatch(/unsupported image format/);
      expect(err.cause).toBeUndefined();
    });
  });

  describe('inputs that already parse', () => {
    // The path every avatar we serve takes. There is no entity anywhere in it,
    // so the retry is unreachable and resize() has to be exactly plain sharp.
    // The colour check is here so the comparison cannot pass on two blanks.
    it('renders an ordinary SVG with no entities like plain sharp', async () => {
      const input = svg('<rect width="64" height="64" fill="#ff0000"/>');

      const output = await resize(input, MAX, MAX);

      expect(output.equals(await directPipeline(input))).toBe(true);

      // Loose because webp is lossy: the point is that it is red rather than
      // blank, which two identical failures would also satisfy.
      const [red, green, blue] = (await sharp(output).stats()).channels;
      expect(red.mean).toBeGreaterThan(240);
      expect(Math.max(green.mean, blue.mean)).toBeLessThan(10);
    });

    it('does not rewrite a valid SVG carrying XML entities', async () => {
      const input = svg('<text y="20">A &amp; B &lt;tag&gt; &quot;q&quot; &apos;a&apos;</text>');

      expect((await resize(input, MAX, MAX)).equals(await directPipeline(input))).toBe(true);
    });

    it('does not rewrite raster input', async () => {
      const png = await sharp({
        create: { width: 8, height: 8, channels: 3, background: '#f00' }
      })
        .png()
        .toBuffer();

      expect((await resize(png, MAX, MAX)).equals(await directPipeline(png))).toBe(true);
    });
  });
});
