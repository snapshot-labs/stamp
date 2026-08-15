import axios from 'axios';
import { lookupAddresses as lensLookupAddresses } from '../../src/addressResolvers/lens';
import ensLookupDomains from '../../src/lookupDomains/ens';
import lensResolve from '../../src/resolvers/lens';
import { resolveSpaceAvatar, resolveUserAvatar } from '../../src/resolvers/snapshot';
import { resolveAvatar as resolveSxSpaceAvatar } from '../../src/resolvers/space-sx';
import { fetchHttpImage } from '../../src/resolvers/utils';

jest.mock('axios', () => {
  const mock: any = jest.fn();
  mock.get = jest.fn();
  mock.post = jest.fn();
  return { __esModule: true, default: mock };
});

jest.mock('../../src/resolvers/utils', () => ({
  ...jest.requireActual('../../src/resolvers/utils'),
  fetchHttpImage: jest.fn()
}));

const mockedAxios = axios as unknown as jest.Mock;

const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';
const IMAGE_URL = 'https://example.com/avatar.png';

const ENS_SUBGRAPH = '[subgrapher.snapshot.org]';

function respondWith(body: any, status = 200) {
  mockedAxios.mockResolvedValue({ status, data: body });
}

function upstreamFailure(message: string, data: any = null) {
  return { errors: [{ message }], data };
}

describe('graphQlCall callers surface an envelope failure', () => {
  describe('src/addressResolvers/lens.ts - accountsBulk', () => {
    it('rejects with the upstream message', async () => {
      respondWith(upstreamFailure('Rate limit exceeded'));

      await expect(lensLookupAddresses([ADDRESS])).rejects.toThrow(
        '[api.lens.xyz] Rate limit exceeded'
      );
    });
  });

  describe('src/lookupDomains/ens.ts - account', () => {
    it('rejects with the upstream message', async () => {
      respondWith(upstreamFailure('bad indexers'));

      await expect(ensLookupDomains(ADDRESS)).rejects.toThrow(`${ENS_SUBGRAPH} bad indexers`);
    });

    it('still returns empty for an address the subgraph has no account for', async () => {
      respondWith({ data: { account: null } });

      await expect(ensLookupDomains(ADDRESS)).resolves.toEqual([]);
    });
  });

  describe('src/lookupDomains/ens.ts - registration', () => {
    const hashedDomain = {
      data: {
        account: { domains: [{ name: '[7f3a].eth' }], wrappedDomains: [] }
      }
    };

    function answerWith(second: any) {
      mockedAxios
        .mockResolvedValueOnce({ status: 200, data: hashedDomain })
        .mockResolvedValueOnce({ status: 200, data: second });
    }

    it('decodes the label when the subgraph answers', async () => {
      answerWith({ data: { registration: { domain: { labelName: 'vitalik' } } } });

      await expect(ensLookupDomains(ADDRESS)).resolves.toEqual(['vitalik.eth']);
    });

    it('keeps the hashed name when the label is genuinely unknown', async () => {
      answerWith({ data: { registration: null } });

      await expect(ensLookupDomains(ADDRESS)).resolves.toEqual(['[7f3a].eth']);
    });

    it('rejects rather than returning the undecoded name when the subgraph fails', async () => {
      answerWith(upstreamFailure('bad indexers'));

      await expect(ensLookupDomains(ADDRESS)).rejects.toThrow(`${ENS_SUBGRAPH} bad indexers`);
    });
  });

  describe('src/resolvers/snapshot.ts - entry', () => {
    it('does not use a payload the upstream flagged as an error', async () => {
      respondWith(upstreamFailure('hub is down', { entry: { avatar: IMAGE_URL } }));

      await expect(resolveUserAvatar(ADDRESS)).resolves.toBe(false);
      expect(fetchHttpImage).not.toHaveBeenCalled();
    });
  });

  describe('src/resolvers/snapshot.ts - spaces', () => {
    it('does not use a payload the upstream flagged as an error', async () => {
      respondWith(
        upstreamFailure('subgraph is down', { spaces: [{ metadata: { avatar: IMAGE_URL } }] })
      );

      await expect(resolveSpaceAvatar(ADDRESS, 1, 'eth')).resolves.toBe(false);
      expect(fetchHttpImage).not.toHaveBeenCalled();
    });
  });

  describe('src/resolvers/space-sx.ts - spaces', () => {
    it('does not use a payload the upstream flagged as an error', async () => {
      respondWith(
        upstreamFailure('subgraph is down', { spaces: [{ metadata: { avatar: IMAGE_URL } }] })
      );

      await expect(resolveSxSpaceAvatar(ADDRESS)).resolves.toBe(false);
      expect(fetchHttpImage).not.toHaveBeenCalled();
    });
  });

  describe('src/resolvers/lens.ts - account', () => {
    it('does not use a payload the upstream flagged as an error', async () => {
      respondWith(
        upstreamFailure('Rate limit exceeded', { account: { metadata: { picture: IMAGE_URL } } })
      );

      await expect(lensResolve(ADDRESS)).resolves.toBe(false);
      expect(fetchHttpImage).not.toHaveBeenCalled();
    });
  });
});
