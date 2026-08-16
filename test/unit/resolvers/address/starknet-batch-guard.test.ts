const mockCallContract = jest.fn();

jest.mock('@snapshot-labs/snapshot-sentry', () => ({ capture: jest.fn() }));

// Run the resolver fan-out on every call, without a redis round trip.
jest.mock('../../../../src/resolvers/address/cache', () => ({
  __esModule: true,
  default: (input: string[], callback: (input: string[]) => any) => callback(input),
  clear: jest.fn()
}));

jest.mock('../../../../src/helpers/provider', () => {
  const actual = jest.requireActual('../../../../src/helpers/provider');

  return { ...actual, provider: () => ({ callContract: mockCallContract }) };
});

import { capture } from '@snapshot-labs/snapshot-sentry';
import { lookupAddresses } from '../../../../src/resolvers/address';
import * as basename from '../../../../src/resolvers/address/basename';
import * as ens from '../../../../src/resolvers/address/ens';
import * as gwei from '../../../../src/resolvers/address/gwei';
import * as lens from '../../../../src/resolvers/address/lens';
import * as shibarium from '../../../../src/resolvers/address/shibarium';
import * as snapshotResolver from '../../../../src/resolvers/address/snapshot';
import * as spaceId from '../../../../src/resolvers/address/spaceId';
import * as unstoppableDomains from '../../../../src/resolvers/address/unstoppableDomains';

// Every resolver but Starknet, which is the one under test here.
const OTHER_RESOLVERS = [
  snapshotResolver,
  ens,
  basename,
  unstoppableDomains,
  lens,
  shibarium,
  spaceId,
  gwei
];

const EVM_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
// Below 2^251 - 256, so a real Starknet address.
const IN_RANGE = '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';
// At the bound: the same 64 hex-digit shape, but not an address. A transaction hash or a
// proposal id looks exactly like this, and about 97% of them land here.
const OUT_OF_RANGE = '0x07ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';

// The two values as the felts `CallData.compile` emits, pinned rather than recomputed.
const IN_RANGE_FELT =
  '3617475073865317856576155523118490860061508207210341692414423635860939015053';
const OUT_OF_RANGE_FELT =
  '3618502788666131106986593281521497120414687020801267626233049500247285300992';

const hex = (n: number) => `0x${n.toString(16)}`;

// One empty domain span per call: every address resolves to no name, and nothing throws.
function emptyDomainSpans(count: number): string[] {
  const body = Array.from({ length: count }, () => ['0x1', '0x0']).flat();

  return ['0x1', hex(body.length), ...body];
}

beforeEach(() => {
  mockCallContract.mockImplementation(async (call: { calldata: string[] }) =>
    emptyDomainSpans(Number(call.calldata[0]))
  );
  OTHER_RESOLVERS.forEach(resolver =>
    jest.spyOn(resolver, 'lookupAddresses').mockResolvedValue({})
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

// starknet.ts guards the felt bound itself; this pins the other half, the shared
// `normalizeAddresses` that resolvers/address/index runs before any resolver sees the input.
// Name resolution is a single atomic multicall, so one out-of-range felt fails the whole
// batch with a `-32602 ... maximum field value was exceeded` that `isSilencedError` does
// not silence -- reported as an outage for every address queried alongside it.
describe('Starknet batch guard', () => {
  it('keeps an out-of-range 64 hex-digit value out of the naming multicall', async () => {
    await lookupAddresses([EVM_ADDRESS, IN_RANGE, OUT_OF_RANGE]);

    expect(mockCallContract).toHaveBeenCalledTimes(1);

    const { calldata } = mockCallContract.mock.calls[0][0];
    expect(calldata).toContain(IN_RANGE_FELT);
    expect(calldata).not.toContain(OUT_OF_RANGE_FELT);
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not call the contract at all when every address is out of range', async () => {
    await expect(lookupAddresses([OUT_OF_RANGE])).resolves.toEqual({});

    expect(mockCallContract).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });
});
