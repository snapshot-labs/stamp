import axios from 'axios';
import { fetchHttpImage } from '../../src/helpers/image';
import { lookupAddresses as lensLookupAddresses } from '../../src/resolvers/address/lens';
import lensResolve from '../../src/resolvers/image/lens';
import { resolveSpaceAvatar, resolveUserAvatar } from '../../src/resolvers/image/snapshot';
import { resolveAvatar as resolveSxSpaceAvatar } from '../../src/resolvers/image/space-sx';
import ensLookupDomains from '../../src/resolvers/lookupDomains/ens';

jest.mock('axios', () => {
  const mock: any = jest.fn();
  mock.get = jest.fn();
  mock.post = jest.fn();
  return { __esModule: true, default: mock };
});

jest.mock('../../src/helpers/image', () => ({
  ...jest.requireActual('../../src/helpers/image'),
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
  describe('src/resolvers/address/lens.ts - accountsBulk', () => {
    it('rejects with the upstream message', async () => {
      respondWith(upstreamFailure('Rate limit exceeded'));

      await expect(lensLookupAddresses([ADDRESS])).rejects.toThrow(
        '[api.lens.xyz] Rate limit exceeded'
      );
    });
  });

  describe('src/resolvers/lookupDomains/ens.ts - account', () => {
    it('rejects with the upstream message', async () => {
      respondWith(upstreamFailure('bad indexers'));

      await expect(ensLookupDomains(ADDRESS)).rejects.toThrow(`${ENS_SUBGRAPH} bad indexers`);
    });

    it('still returns empty for an address the subgraph has no account for', async () => {
      respondWith({ data: { account: null } });

      await expect(ensLookupDomains(ADDRESS)).resolves.toEqual([]);
    });
  });

  describe('src/resolvers/lookupDomains/ens.ts - registration', () => {
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

  describe('src/resolvers/image/snapshot.ts - entry', () => {
    it('does not use a payload the upstream flagged as an error', async () => {
      respondWith(upstreamFailure('hub is down', { entry: { avatar: IMAGE_URL } }));

      await expect(resolveUserAvatar(ADDRESS)).rejects.toThrow('hub is down');
      expect(fetchHttpImage).not.toHaveBeenCalled();
    });
  });

  describe('src/resolvers/image/snapshot.ts - spaces', () => {
    it('does not use a payload the upstream flagged as an error', async () => {
      respondWith(
        upstreamFailure('subgraph is down', { spaces: [{ metadata: { avatar: IMAGE_URL } }] })
      );

      await expect(resolveSpaceAvatar(ADDRESS, 1, 'eth')).rejects.toThrow(
        '[api.snapshot.box] subgraph is down'
      );
      expect(fetchHttpImage).not.toHaveBeenCalled();
    });
  });

  describe('src/resolvers/image/space-sx.ts - spaces', () => {
    it('does not use a payload the upstream flagged as an error', async () => {
      respondWith(
        upstreamFailure('subgraph is down', { spaces: [{ metadata: { avatar: IMAGE_URL } }] })
      );

      await expect(resolveSxSpaceAvatar(ADDRESS)).rejects.toMatchObject({
        errors: expect.arrayContaining([
          expect.objectContaining({ message: '[api.snapshot.box] subgraph is down' })
        ])
      });
      expect(fetchHttpImage).not.toHaveBeenCalled();
    });
  });

  describe('src/resolvers/image/lens.ts - account', () => {
    it('does not use a payload the upstream flagged as an error', async () => {
      respondWith(
        upstreamFailure('Rate limit exceeded', { account: { metadata: { picture: IMAGE_URL } } })
      );

      await expect(lensResolve(ADDRESS)).rejects.toThrow('[api.lens.xyz] Rate limit exceeded');
      expect(fetchHttpImage).not.toHaveBeenCalled();
    });
  });
});
