import { capture } from '@snapshot-labs/snapshot-sentry';
import lookupDomains from '../../../src/resolvers/lookupDomains';
import ens from '../../../src/resolvers/lookupDomains/ens';
import shibarium from '../../../src/resolvers/lookupDomains/shibarium';
import unstoppableDomains from '../../../src/resolvers/lookupDomains/unstoppableDomains';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

jest.mock('../../../src/resolvers/lookupDomains/ens', () => ({
  __esModule: true,
  NAME: 'Ens',
  DEFAULT_CHAIN_ID: '1',
  CHAIN_IDS: ['1', '11155111'],
  default: jest.fn()
}));
jest.mock('../../../src/resolvers/lookupDomains/shibarium', () => ({
  __esModule: true,
  NAME: 'Shibarium',
  DEFAULT_CHAIN_ID: '109',
  CHAIN_IDS: ['109', '157'],
  default: jest.fn()
}));
jest.mock('../../../src/resolvers/lookupDomains/unstoppableDomains', () => ({
  __esModule: true,
  NAME: 'Unstoppable Domains',
  DEFAULT_CHAIN_ID: '146',
  CHAIN_IDS: ['146'],
  default: jest.fn()
}));

const VALID_ADDRESS = '0x24F15402C6Bb870554489b2fd2049A85d75B982f';
const CHAINS = ['1', '109', '146'];
const ENS_CHAINS = ['1', '11155111'];

describe('lookupDomains - default chains', () => {
  it('calls every provider on its own default chain when no chain is given', async () => {
    (ens as jest.Mock).mockResolvedValue([]);
    (shibarium as jest.Mock).mockResolvedValue([]);
    (unstoppableDomains as jest.Mock).mockResolvedValue([]);

    await lookupDomains(VALID_ADDRESS);

    expect(ens).toHaveBeenCalledWith(VALID_ADDRESS, '1');
    expect(shibarium).toHaveBeenCalledWith(VALID_ADDRESS, '109');
    expect(unstoppableDomains).toHaveBeenCalledWith(VALID_ADDRESS, '146');
  });
});

describe('lookupDomains - chain routing', () => {
  beforeEach(() => {
    (ens as jest.Mock).mockResolvedValue([]);
    (shibarium as jest.Mock).mockResolvedValue([]);
    (unstoppableDomains as jest.Mock).mockResolvedValue([]);
  });

  it('does not call a provider for a chain it does not declare', async () => {
    await lookupDomains(VALID_ADDRESS, CHAINS);

    expect(ens).toHaveBeenCalledTimes(1);
    expect(ens).toHaveBeenCalledWith(VALID_ADDRESS, '1');
    expect(shibarium).toHaveBeenCalledTimes(1);
    expect(shibarium).toHaveBeenCalledWith(VALID_ADDRESS, '109');
    expect(unstoppableDomains).toHaveBeenCalledTimes(1);
    expect(unstoppableDomains).toHaveBeenCalledWith(VALID_ADDRESS, '146');
  });

  it('calls a provider for each declared chain, in the requested order', async () => {
    await lookupDomains(VALID_ADDRESS, ['11155111', '1']);

    expect((ens as jest.Mock).mock.calls.map(call => call[1])).toEqual(['11155111', '1']);
    expect(shibarium).not.toHaveBeenCalled();
    expect(unstoppableDomains).not.toHaveBeenCalled();
  });
});

describe('lookupDomains - resolver failures', () => {
  it('does not propagate a resolver failure and returns the other resolvers results', async () => {
    (ens as jest.Mock).mockRejectedValue(new Error('boom'));
    (shibarium as jest.Mock).mockResolvedValue(['boorger.shib']);
    (unstoppableDomains as jest.Mock).mockResolvedValue([]);

    await expect(lookupDomains(VALID_ADDRESS, CHAINS)).resolves.toEqual(['boorger.shib']);
  });

  it('returns an empty array when every resolver fails', async () => {
    (ens as jest.Mock).mockRejectedValue(new Error('boom'));
    (shibarium as jest.Mock).mockRejectedValue(new Error('boom'));
    (unstoppableDomains as jest.Mock).mockRejectedValue(new Error('boom'));

    await expect(lookupDomains(VALID_ADDRESS, CHAINS)).resolves.toEqual([]);
  });
});

describe('lookupDomains - error reporting', () => {
  beforeEach(() => {
    (shibarium as jest.Mock).mockResolvedValue([]);
    (unstoppableDomains as jest.Mock).mockResolvedValue([]);
  });

  it('captures a resolver error, with the address and chain as context', async () => {
    const error = new Error('boom');
    (ens as jest.Mock).mockRejectedValue(error);

    await expect(lookupDomains(VALID_ADDRESS, '1')).resolves.toEqual([]);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(error, {
      tags: { provider: 'Ens' },
      contexts: { input: { address: VALID_ADDRESS, chainId: '1' } }
    });
  });

  // `capture` reads `.error` off whatever it is handed, so a falsy one throws
  // from inside the catch block and takes the whole fan-out down with it.
  it.each([null, undefined])('does not hand capture a rejection carrying %p', async value => {
    (ens as jest.Mock).mockRejectedValue(value);

    await expect(lookupDomains(VALID_ADDRESS, '1')).resolves.toEqual([]);
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not capture a silenced error', async () => {
    (ens as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Unstoppable Domains API error: HTTP 429 Too Many Requests'), {
        status: 429
      })
    );

    await expect(lookupDomains(VALID_ADDRESS, '1')).resolves.toEqual([]);
    expect(capture).not.toHaveBeenCalled();
  });

  it('names the failing provider, each with its own name', async () => {
    (ens as jest.Mock).mockRejectedValue(new Error('boom'));
    (shibarium as jest.Mock).mockRejectedValue(new Error('boom'));
    (unstoppableDomains as jest.Mock).mockRejectedValue(new Error('boom'));

    await expect(lookupDomains(VALID_ADDRESS)).resolves.toEqual([]);
    expect(capture).toHaveBeenCalledTimes(3);
    expect(capture).toHaveBeenCalledWith(expect.any(Error), {
      tags: { provider: 'Ens' },
      contexts: { input: { address: VALID_ADDRESS, chainId: '1' } }
    });
    expect(capture).toHaveBeenCalledWith(expect.any(Error), {
      tags: { provider: 'Shibarium' },
      contexts: { input: { address: VALID_ADDRESS, chainId: '109' } }
    });
    expect(capture).toHaveBeenCalledWith(expect.any(Error), {
      tags: { provider: 'Unstoppable Domains' },
      contexts: { input: { address: VALID_ADDRESS, chainId: '146' } }
    });
  });

  it('captures one event per failing chain', async () => {
    (ens as jest.Mock).mockRejectedValue(new Error('boom'));

    await expect(lookupDomains(VALID_ADDRESS, ENS_CHAINS)).resolves.toEqual([]);
    expect(capture).toHaveBeenCalledTimes(ENS_CHAINS.length);
    ENS_CHAINS.forEach(chainId => {
      expect(capture).toHaveBeenCalledWith(expect.any(Error), {
        tags: { provider: 'Ens' },
        contexts: { input: { address: VALID_ADDRESS, chainId } }
      });
    });
  });
});
