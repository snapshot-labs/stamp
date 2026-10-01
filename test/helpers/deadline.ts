import * as deadline from '../../src/helpers/deadline';

const actual = jest.requireActual<typeof deadline>('../../src/helpers/deadline');

export const SHORT_BUDGET = 200;

// Stands in for src/helpers/deadline through jest.mock. Callers keep their own
// budget unless a test shortens the next one. The short one still runs on a
// real timer rather than being fired by hand: firing it by hand would abort the
// signal even where the code under test had already cleared the timer, which is
// the case a deadline test has to be able to fail on.
export const withDeadline = jest.fn(actual.withDeadline);
export const untilAborted = actual.untilAborted;

export function shortenNextDeadline() {
  withDeadline.mockImplementationOnce(fn => actual.withDeadline(fn, SHORT_BUDGET));
}
