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
});
