import { MatchImageSnapshotOptions } from 'jest-image-snapshot';
import sharp from 'sharp';

// Resolver output is WebP; jest-image-snapshot needs a PNG buffer. This helper
// validates the resolver returned a real image and asserts its decoded pixels
// against a committed baseline.
export async function expectResolverImageSnapshot(
  result: unknown,
  options: MatchImageSnapshotOptions & { customSnapshotIdentifier: string }
): Promise<void> {
  expect(result).toBeInstanceOf(Buffer);
  const png = await sharp(result as Buffer)
    .png()
    .toBuffer();
  expect(png).toMatchImageSnapshot(options);
}
