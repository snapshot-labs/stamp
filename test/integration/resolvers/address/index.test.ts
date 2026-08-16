import redis from '../../../../src/helpers/redis';
import { lookupAddresses, resolveNames } from '../../../../src/resolvers/address';
import { getCache, setCache } from '../../../../src/resolvers/address/cache';
import randomAddresses from '../../../fixtures/addresses';

function purge() {
  if (!redis) return;

  return redis.flushDb();
}

describe('address resolvers', () => {
  describe('lookupAddresses()', () => {
    describe('when passing more than 50 addresses', () => {
      it('rejects with an error', async () => {
        return expect(lookupAddresses(randomAddresses)).rejects.toEqual({
          error: 'params must contains less than 50 items',
          code: 400
        });
      });
    });

    describe('when the params contains invalid address', () => {
      it('should ignore the invalid address', () => {
        expect(
          lookupAddresses(['test', '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7'])
        ).resolves.toEqual({ '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7': 'less' });
      });
    });

    describe('when not cached', () => {
      beforeEach(async () => {
        await purge();
      });

      it('should return the ENS handle first if associated to multiple resolvers', () => {
        return expect(
          lookupAddresses(['0xeF8305E140ac520225DAf050e2f71d5fBcC543e7'])
        ).resolves.toEqual({
          '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7': 'less'
        });
      }, 10e3);

      it('does not return addresses without domain', () => {
        return expect(
          lookupAddresses([
            '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7',
            '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1'
          ])
        ).resolves.toEqual({
          '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7': 'less'
        });
      }, 10e3);

      it('keeps the original input case formatting', () => {
        return expect(
          lookupAddresses([
            '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7',
            '0xEF8305E140AC520225DAF050E2F71D5FBCC543E7',
            '0xef8305e140ac520225daf050e2f71d5fbcc543e7'
          ])
        ).resolves.toEqual({
          '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7': 'less',
          '0xEF8305E140AC520225DAF050E2F71D5FBCC543E7': 'less',
          '0xef8305e140ac520225daf050e2f71d5fbcc543e7': 'less'
        });
      }, 10e3);
    });

    describe('when cached', () => {
      beforeEach(async () => {
        await purge();
      });

      it('should cache the results', async () => {
        await expect(
          lookupAddresses([
            '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7',
            '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1'
          ])
        ).resolves.toEqual({
          '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7': 'less'
        });

        return expect(
          getCache([
            '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7',
            '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1'
          ])
        ).resolves.toEqual({
          '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7': 'less',
          '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1': ''
        });
      });

      it('should return the cached results', async () => {
        await setCache({
          '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7': 'test.eth',
          '0xef8305e140ac520225daf050e2f71d5fbcc543e7': 'test1.eth'
        });

        return expect(
          lookupAddresses([
            '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7',
            '0xef8305e140ac520225daf050e2f71d5fbcc543e7'
          ])
        ).resolves.toEqual({
          '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7': 'test.eth',
          '0xef8305e140ac520225daf050e2f71d5fbcc543e7': 'test.eth'
        });
      });
    });
  });

  describe('resolveNames()', () => {
    describe('when passing more than 5 addresses', () => {
      it('rejects with an error', async () => {
        const params = ['1.com', '2.com', '3.com', '4.com', '5.com', '6.com'];

        return expect(resolveNames(params)).rejects.toEqual({
          error: 'params must contains less than 5 items',
          code: 400
        });
      });
    });

    describe('when not cached', () => {
      beforeEach(async () => {
        await purge();
      });

      it('should return the address associated to the handle', () => {
        return expect(resolveNames(['snapshot.crypto'])).resolves.toEqual({
          'snapshot.crypto': '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7'
        });
      }, 10e3);

      it('return null when the handle does not exist', () => {
        return expect(resolveNames(['test-snapshot.eth'])).resolves.toEqual({
          'test-snapshot.eth': undefined
        });
      }, 10e3);

      it('keeps the original case formatting', () => {
        return expect(
          resolveNames(['snapshot.crypto', 'SNAPSHOT.CRYPTO', 'Snapshot.Crypto'])
        ).resolves.toEqual({
          'snapshot.crypto': '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7',
          'SNAPSHOT.CRYPTO': '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7',
          'Snapshot.Crypto': '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7'
        });
      }, 10e3);
    });

    describe('when cached', () => {
      beforeEach(async () => {
        await purge();
      });

      it('should cache the results', async () => {
        await expect(resolveNames(['snapshot.crypto'])).resolves.toEqual({
          'snapshot.crypto': '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7'
        });

        return expect(getCache(['snapshot.crypto'])).resolves.toEqual({
          'snapshot.crypto': '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7'
        });
      });

      it('should return the cached results', async () => {
        await setCache({ 'snapshot.crypto': '0x0', 'SNAPSHOT.CRYPTO': '0x1' });

        return expect(resolveNames(['snapshot.crypto', 'SNAPSHOT.CRYPTO'])).resolves.toEqual({
          'snapshot.crypto': '0x0',
          'SNAPSHOT.CRYPTO': '0x0'
        });
      });
    });
  });
});
