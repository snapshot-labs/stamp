import resolvers from '../../../src/resolvers';

// TEMP CI probe for keyed resolvers (coingecko/farcaster) - logs real
// fallback-vs-false behaviour against live upstreams using the CI secrets.
// Removed after the audit.
function d(r: unknown): string {
  if (r === false) return 'false';
  if (Buffer.isBuffer(r)) return `BUFFER(${r.length} bytes)`;
  return `OTHER ${String(r)}`;
}

const ZERO = '0x0000000000000000000000000000000000000000';
const NO_ACC = '0x2963fD170E12d748d0A80430DdC090e059f6013F';
const JUNK = '0x1234567890123456789012345678901234567890';

describe('CI_PROBE', () => {
  jest.retryTimes(0);

  it('coingecko fallback audit', async () => {
    console.log(`CIPROBE COINGECKO key=${!!process.env.COINGECKO_API_KEY}`);
    for (const [label, addr, chain] of [
      ['zero/1', ZERO, '1'],
      ['junk/1', JUNK, '1'],
      ['zero/base', ZERO, '8453']
    ] as const) {
      const r = await resolvers.coingecko(addr, chain);
      console.log(`CIPROBE COINGECKO[${label}] => ${d(r)}`);
    }
  }, 60e3);

  it('farcaster fallback audit', async () => {
    console.log(`CIPROBE FARCASTER key=${!!process.env.NEYNAR_API_KEY}`);
    for (const [label, addr] of [
      ['zero', ZERO],
      ['no-account', NO_ACC],
      ['junk', JUNK]
    ] as const) {
      const r = await resolvers.farcaster(addr);
      console.log(`CIPROBE FARCASTER[${label}] => ${d(r)}`);
    }
  }, 60e3);
});
