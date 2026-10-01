import { withDeadline } from '../../../src/helpers/deadline';

describe('withDeadline', () => {
  it('aborts the signal once the call has resolved', async () => {
    let signal: AbortSignal | undefined;

    await withDeadline(async s => {
      signal = s;
      return 'done';
    });

    expect(signal?.aborted).toBe(true);
  });

  it('aborts the signal once the call has thrown', async () => {
    let signal: AbortSignal | undefined;

    await expect(
      withDeadline(async s => {
        signal = s;
        throw new Error('upstream said no');
      })
    ).rejects.toThrow('upstream said no');

    expect(signal?.aborted).toBe(true);
  });

  describe('on a call that never settles', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it.each([
      ['an explicit budget', 5e3, 5e3],
      ['the default budget', undefined, 10e3]
    ])('aborts at %s and not before', async (_name, budget, expires) => {
      jest.useFakeTimers();
      let signal!: AbortSignal;
      const result = withDeadline<never>(
        s =>
          new Promise((_, reject) => {
            signal = s;
            s.addEventListener('abort', () => reject(s.reason), { once: true });
          }),
        budget
      ).catch((err: Error) => err);

      jest.advanceTimersByTime(expires - 1);
      expect(signal.aborted).toBe(false);

      jest.advanceTimersByTime(1);
      expect((await result).name).toBe('AbortError');
    });
  });
});
