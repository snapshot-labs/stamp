import resolvers from '../../../../src/resolvers/image';
import {
  blockieSnapshotAddresses,
  jazziconSnapshotAddresses
} from '../../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../../helpers/imageSnapshot';

describe.each([
  ['blockie', blockieSnapshotAddresses],
  ['jazzicon', jazziconSnapshotAddresses]
] as const)('resolvers %s', (name, addresses) => {
  it.each(addresses)('matches the image snapshot for %s', async address => {
    await expectResolverImageSnapshot(await resolvers[name](address), {
      customDiffConfig: { threshold: 0.05 },
      customSnapshotIdentifier: `${name}-${address}`
    });
  });
});
