import resolvers from '../../../src/resolvers';
import {
  remoteSnapshotInputs,
  remoteSnapshotOptions,
  ZERO_ADDRESS
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

// snapshot resolvers fetch user/space avatars and covers hosted on the Snapshot
// infra for REAL, then resize/re-encode via sharp. Every image-returning case
// asserts a TOLERANT image snapshot of the real output; the legacy/non-legacy
// equivalence cases stay as structural assertions (they verify behaviour, not
// pixels). The fallback path (no avatar / zero address) returns false: snapshot
// resolvers have no default fallback image.
describe('resolvers', () => {
  describe('snapshot', () => {
    describe('on user avatar', () => {
      it('should return false if missing', async () => {
        const result = await resolvers.snapshot('0x556B14CbdA79A36dC33FcD461a04A5BCb5dC2A70');

        expect(result).toBe(false);
      });

      it('returns false for the zero address (no fallback image)', async () => {
        const result = await resolvers.snapshot(ZERO_ADDRESS);

        expect(result).toBe(false);
      });

      it('resolves regardless of network and matches the reference avatar', async () => {
        const result = await resolvers.snapshot(remoteSnapshotInputs.snapshotUserAvatar, 1, 'eth');

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'snapshot-user-avatar'
        });
      });

      it('resolves and matches the reference avatar', async () => {
        const result = await resolvers.snapshot(remoteSnapshotInputs.snapshotUserAvatar);

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'snapshot-user-avatar'
        });
      }, 30e3);
    });
  });

  describe('on user cover', () => {
    it('should return false if missing', async () => {
      const result = await resolvers['user-cover']('0x556B14CbdA79A36dC33FcD461a04A5BCb5dC2A70');

      expect(result).toBe(false);
    });

    it('returns false for the zero address (no fallback image)', async () => {
      const result = await resolvers['user-cover'](ZERO_ADDRESS);

      expect(result).toBe(false);
    });

    it('resolves regardless of network and matches the reference cover', async () => {
      const result = await resolvers['user-cover'](
        remoteSnapshotInputs.snapshotUserCover,
        1,
        'eth'
      );

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'snapshot-user-cover'
      });
    });

    it('resolves and matches the reference cover', async () => {
      const result = await resolvers['user-cover'](remoteSnapshotInputs.snapshotUserCover);

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'snapshot-user-cover'
      });
    }, 30e3);
  });

  describe('on space avatar', () => {
    it('should return false if missing', async () => {
      const result = await resolvers.space('idonthaveensdomain.eth');

      expect(result).toBe(false);
    });

    it('returns false for the zero address (no fallback image)', async () => {
      const result = await resolvers.space(ZERO_ADDRESS);

      expect(result).toBe(false);
    });

    it('should return false on unsupported network', async () => {
      const result = await resolvers.space('ens.eth', 1, 'eth');

      expect(result).toBe(false);
    });

    it('resolves and matches the reference avatar', async () => {
      const result = await resolvers.space(remoteSnapshotInputs.snapshotSpaceAvatar);

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'snapshot-space-avatar'
      });
    }, 30e3);

    it('should return same result for both legacy and non-legacy format', async () => {
      const resultA = await resolvers.space(remoteSnapshotInputs.snapshotSpaceAvatar);
      const resultB = await resolvers.space(remoteSnapshotInputs.snapshotSpaceAvatar, 1, 's');

      expect(resultA).toEqual(resultB);
    });
  });

  describe('on space cover', () => {
    it('should return false if missing', async () => {
      const result = await resolvers['space-cover']('idonthaveensdomain.eth');

      expect(result).toBe(false);
    });

    it('returns false for the zero address (no fallback image)', async () => {
      const result = await resolvers['space-cover'](ZERO_ADDRESS);

      expect(result).toBe(false);
    });

    it('should return false on unsupported network', async () => {
      const result = await resolvers['space-cover'](
        remoteSnapshotInputs.snapshotSpaceCover,
        1,
        'eth'
      );

      expect(result).toBe(false);
    });

    it('resolves and matches the reference cover', async () => {
      const result = await resolvers['space-cover'](remoteSnapshotInputs.snapshotSpaceCover);

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'snapshot-space-cover'
      });
    }, 30e3);

    it('should return same result for both legacy and non-legacy format', async () => {
      const resultA = await resolvers['space-cover'](remoteSnapshotInputs.snapshotSpaceCover);
      const resultB = await resolvers['space-cover'](
        remoteSnapshotInputs.snapshotSpaceCover,
        1,
        's'
      );

      expect(resultA).toEqual(resultB);
    });
  });
});
