/*
 * Regenerates the committed deterministic-resolver reference images.
 *
 * Run with: `yarn ts-node test/helpers/generate-references.ts`
 *
 * Only deterministic, locally-generated resolvers are included (blockie,
 * jazzicon). Remote-fetch resolvers (ens/lens/coingecko/farcaster/snapshot/
 * starknet/...) are intentionally excluded: they resize images fetched over
 * the network and are not reproducible offline.
 */
import { PIXEL_FIXTURE_ADDRESSES } from './fixture-addresses';
import { writeReference } from './image';
import resolvers from '../../src/resolvers';

const DETERMINISTIC_RESOLVERS = ['blockie', 'jazzicon'] as const;

async function main() {
  for (const resolver of DETERMINISTIC_RESOLVERS) {
    for (const address of PIXEL_FIXTURE_ADDRESSES) {
      const output = await resolvers[resolver](address);
      if (!Buffer.isBuffer(output)) {
        throw new Error(`Resolver ${resolver} did not return a Buffer for ${address}`);
      }
      const path = await writeReference(resolver, address, output);
      console.info(`wrote ${path}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
