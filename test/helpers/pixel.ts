import { existsSync, readFileSync } from 'fs';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { referencePath, toRgba } from './image';

// Allow a tiny number of differing pixels to absorb anti-aliasing noise across
// platforms / sharp versions. The matcher fails if the diff exceeds this.
const DEFAULT_MAX_DIFF_PIXELS = 50;
// pixelmatch per-pixel sensitivity (0 strict, 1 lax).
const DEFAULT_THRESHOLD = 0.1;

interface MatchOptions {
  maxDiffPixels?: number;
  threshold?: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toMatchImageSnapshot(resolver: string, address: string, options?: MatchOptions): Promise<R>;
    }
  }
}

expect.extend({
  async toMatchImageSnapshot(
    received: Buffer,
    resolver: string,
    address: string,
    options: MatchOptions = {}
  ) {
    const maxDiffPixels = options.maxDiffPixels ?? DEFAULT_MAX_DIFF_PIXELS;
    const threshold = options.threshold ?? DEFAULT_THRESHOLD;
    const path = referencePath(resolver, address);

    if (!Buffer.isBuffer(received)) {
      return {
        pass: false,
        message: () =>
          `Expected resolver output to be a Buffer, received ${typeof received}. ` +
          `Resolver "${resolver}" may have returned false/null for ${address}.`
      };
    }

    if (!existsSync(path)) {
      return {
        pass: false,
        message: () =>
          `Missing reference image at ${path}. Regenerate with ` +
          `\`yarn ts-node test/helpers/generate-references.ts\`.`
      };
    }

    const actual = await toRgba(received);
    const reference = await toRgba(readFileSync(path));

    if (actual.width !== reference.width || actual.height !== reference.height) {
      return {
        pass: false,
        message: () =>
          `Image dimensions differ for ${resolver}/${address}: ` +
          `actual ${actual.width}x${actual.height} vs reference ` +
          `${reference.width}x${reference.height}.`
      };
    }

    const diff = new PNG({ width: actual.width, height: actual.height });
    const diffPixels = pixelmatch(
      actual.data,
      reference.data,
      diff.data,
      actual.width,
      actual.height,
      { threshold }
    );

    const pass = diffPixels <= maxDiffPixels;
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${resolver}/${address} not to match reference, but it did ` +
            `(${diffPixels} differing pixels).`
          : `Expected ${resolver}/${address} to match reference within ` +
            `${maxDiffPixels} px, but ${diffPixels} pixels differ. ` +
            `If this change is intentional, regenerate references with ` +
            `\`yarn ts-node test/helpers/generate-references.ts\`.`
    };
  }
});

export {};
