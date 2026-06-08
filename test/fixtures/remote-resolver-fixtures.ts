// Fixtures for the REMOTE-FETCH resolver pixel tests.
//
// These are intentionally separate from test/fixtures/image-snapshot-addresses.ts
// (which is pinned to the deterministic identicon resolvers from #454). The
// remote resolvers fetch a remote image and then resize/encode it via sharp.
// Pixel-testing them deterministically requires MOCKING the network fetch so it
// returns a committed sample SOURCE image fixture; the test then asserts the
// OUTPUT of the deterministic sharp resize/encode pipeline (what a sharp/lib
// bump would change), not the network.
//
// Structured per resolver, matching the per-resolver convention. Each entry is
// the input the resolver is called with plus the committed source image used as
// the mocked fetch response. The committed reference PNGs under
// __image_snapshots__ are pinned to these exact values.

import { readFileSync } from 'fs';
import { join } from 'path';

const SOURCE_DIR = join(__dirname, 'images', 'source');

export const SAMPLE_AVATAR_PATH = join(SOURCE_DIR, 'sample-avatar.png');
export const SAMPLE_COVER_PATH = join(SOURCE_DIR, 'sample-cover.png');

export function loadSampleAvatar(): Buffer {
  return readFileSync(SAMPLE_AVATAR_PATH);
}

export function loadSampleCover(): Buffer {
  return readFileSync(SAMPLE_COVER_PATH);
}

// A stable checksummed address reused across resolvers that key off an address.
const ADDRESS = '0x89ceF96c58A85d9bE6DFa46D667e71f45f9Ad046';

export const remoteResolverFixtures = {
  trustwallet: {
    input: { address: ADDRESS, chainId: '1' },
    source: 'avatar' as const
  },
  zapper: {
    input: { address: ADDRESS, chainId: '1' },
    source: 'avatar' as const
  },
  coingecko: {
    input: { address: ADDRESS, chainId: '1' },
    // URL the mocked metadata fetch resolves the image to.
    metadataImageUrl: 'https://example.test/coingecko-token.png',
    source: 'avatar' as const
  },
  ens: {
    // A .eth name so the resolver skips the address->name lookup branch.
    input: { nameOrAddress: 'stamp-fixture.eth' },
    avatarUrl: 'https://example.test/ens-avatar.png',
    source: 'avatar' as const
  },
  basename: {
    input: { nameOrAddress: 'stamp-fixture.base.eth' },
    avatarUrl: 'https://example.test/basename-avatar.png',
    source: 'avatar' as const
  },
  farcaster: {
    input: { address: ADDRESS },
    pfpUrl: 'https://example.test/farcaster-pfp.png',
    source: 'avatar' as const
  },
  lens: {
    input: { domainOrAddress: 'stamp-fixture.lens' },
    pictureUrl: 'https://example.test/lens-picture.png',
    source: 'avatar' as const
  },
  snapshot: {
    // resolveUserAvatar(address)
    input: { address: ADDRESS },
    avatarValue: 'https://example.test/snapshot-user-avatar.png',
    source: 'avatar' as const
  },
  spaceSx: {
    // space-sx resolveAvatar(key)
    input: { key: ADDRESS },
    avatarValue: 'https://example.test/space-sx-avatar.png',
    source: 'avatar' as const
  }
} as const;
