const mockCallContract = jest.fn();

jest.mock('../../../src/addressResolvers/utils', () => {
  const actual = jest.requireActual('../../../src/addressResolvers/utils');

  return {
    ...actual,
    provider: () => ({ callContract: mockCallContract })
  };
});

import { starknetId } from 'starknet';
import { lookupAddresses, resolveNames } from '../../../src/addressResolvers/starknet';

const PADDED = '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';
const UNPADDED = '0x7ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';
const MIXED_CASE = '0x7FF6b17F07c4d83236e3FC5f94259a19D1ed41BBcf1822397ea17882e9B038D';
const ZERO_ADDRESS = `0x${'0'.repeat(64)}`;
const EVM_ADDRESS = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';
// The felt `checkpoint.stark` encodes to, as returned live by address_to_domain.
const CHECKPOINT_FELT = '0xb5b47279a7f0c';

const hex = (n: number) => `0x${n.toString(16)}`;

// The `aggregate` retdata shape snapshot.js parses: block number, total length, then
// each call's response prefixed with its own length.
function aggregateResponse(responses: string[][]): string[] {
  const body = responses.flatMap(response => [hex(response.length), ...response]);

  return ['0x1', hex(body.length), ...body];
}

const mockDomains = (...spans: string[][]) =>
  mockCallContract.mockResolvedValueOnce(
    aggregateResponse(spans.map(span => [hex(span.length), ...span]))
  );

const mockAddresses = (...addresses: string[]) =>
  mockCallContract.mockResolvedValueOnce(aggregateResponse(addresses.map(address => [address])));

// A response that stops before the slot the ABI promises.
const mockTruncated = () => mockCallContract.mockResolvedValueOnce(aggregateResponse([[]]));

beforeEach(() => {
  mockCallContract.mockReset();
});

describe('Starknet address resolver', () => {
  describe('resolveNames()', () => {
    describe('address padding', () => {
      it('pads the unpadded address returned by the contract to 64 hex digits', async () => {
        mockAddresses(UNPADDED);

        await expect(resolveNames(['checkpoint.stark'])).resolves.toEqual({
          'checkpoint.stark': PADDED
        });
      });

      it('returns an already padded address unchanged', async () => {
        mockAddresses(PADDED);

        await expect(resolveNames(['checkpoint.stark'])).resolves.toEqual({
          'checkpoint.stark': PADDED
        });
      });

      it('lowercases a mixed-case address', async () => {
        mockAddresses(MIXED_CASE);

        await expect(resolveNames(['checkpoint.stark'])).resolves.toEqual({
          'checkpoint.stark': PADDED
        });
      });

      it('pads an EVM-shaped 40 hex digits address', async () => {
        mockAddresses(EVM_ADDRESS);

        await expect(resolveNames(['evm.stark'])).resolves.toEqual({
          'evm.stark': `0x${'0'.repeat(24)}d8da6bf26964af9d7eed9e03e53415d37aa96045`
        });
      });
    });

    describe('when the name has no address', () => {
      it.each(['0x0', ZERO_ADDRESS])('drops %p', async value => {
        mockAddresses(value);

        await expect(resolveNames(['checkpoint.stark'])).resolves.toEqual({});
      });

      it('drops a name whose slot is missing from the response', async () => {
        mockTruncated();

        await expect(resolveNames(['checkpoint.stark'])).resolves.toEqual({});
      });
    });

    describe('when the contract returns a value that is not an address', () => {
      it.each([
        ['more than 64 hex digits', `0x1${'f'.repeat(64)}`],
        ['a felt above the address bound', `0x${'f'.repeat(64)}`]
      ])('rejects on %s, leaving the report to addressResolvers/index', async (_, value) => {
        mockAddresses(value);

        await expect(resolveNames(['checkpoint.stark'])).rejects.toThrow();
      });
    });

    it('rejects when the call fails, leaving the report to addressResolvers/index', async () => {
      const error = new Error('fetch failed');
      mockCallContract.mockRejectedValueOnce(error);

      await expect(resolveNames(['checkpoint.stark'])).rejects.toBe(error);
    });

    it('ignores non-stark handles', async () => {
      await expect(resolveNames(['domain.eth', 'domain.crypto'])).resolves.toEqual({});
      expect(mockCallContract).not.toHaveBeenCalled();
    });

    // StarknetID's encoder drops any character outside [a-z0-9-] instead of rejecting
    // it, so these would otherwise encode like a shorter, registered handle and come
    // back with someone else's address. They must not reach the contract at all.
    it.each(['a!b.stark', '!!!.stark', '.stark', 'a b.stark', 'a_b.stark', 'ab.stark.eth'])(
      'ignores %p, without looking it up',
      async handle => {
        await expect(resolveNames([handle])).resolves.toEqual({});
        expect(mockCallContract).not.toHaveBeenCalled();
      }
    );

    it.each(['ab.stark', 'notion.eth.stark', 'a-b.stark', '123.stark'])(
      'still resolves %p',
      async handle => {
        mockAddresses(PADDED);

        await expect(resolveNames([handle])).resolves.toEqual({ [handle]: PADDED });

        const labels = handle
          .replace(/\.stark$/, '')
          .split('.')
          .map(label => starknetId.useEncoded(label).toString(10));

        expect(mockCallContract.mock.calls[0][0].calldata).toEqual(expect.arrayContaining(labels));
      }
    );

    it('resolves a whole batch in a single call', async () => {
      mockAddresses(PADDED, ZERO_ADDRESS, UNPADDED);

      await expect(
        resolveNames(['checkpoint.stark', 'blank.stark', 'other.stark'])
      ).resolves.toEqual({
        'checkpoint.stark': PADDED,
        'other.stark': PADDED
      });
      expect(mockCallContract).toHaveBeenCalledTimes(1);
    });
  });

  describe('lookupAddresses()', () => {
    it('decodes the domain returned as a span of felts', async () => {
      mockDomains([CHECKPOINT_FELT]);

      await expect(lookupAddresses([PADDED])).resolves.toEqual({
        [PADDED]: 'checkpoint.stark'
      });
    });

    it('drops addresses without a name, and keeps the others', async () => {
      mockDomains([CHECKPOINT_FELT], []);

      await expect(lookupAddresses([PADDED, ZERO_ADDRESS])).resolves.toEqual({
        [PADDED]: 'checkpoint.stark'
      });
      expect(mockCallContract).toHaveBeenCalledTimes(1);
    });

    it('drops an address whose slot is missing from the response', async () => {
      mockTruncated();

      await expect(lookupAddresses([PADDED])).resolves.toEqual({});
    });

    it('rejects with any other error, leaving the report to addressResolvers/index', async () => {
      const error = new Error('Could not get stark name');
      mockCallContract.mockRejectedValueOnce(error);

      await expect(lookupAddresses([PADDED])).rejects.toBe(error);
    });

    it('ignores non-starknet addresses', async () => {
      await expect(lookupAddresses([EVM_ADDRESS])).resolves.toEqual({});
      expect(mockCallContract).not.toHaveBeenCalled();
    });

    it('ignores a 64 hex-digit value above the felt address bound', async () => {
      await expect(lookupAddresses([`0x${'f'.repeat(64)}`])).resolves.toEqual({});
      expect(mockCallContract).not.toHaveBeenCalled();
    });
  });
});
