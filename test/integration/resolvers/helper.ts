import resolvers from '../../../src/resolvers';
import { remoteSnapshotOptions } from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

type ResolverName = keyof typeof resolvers;

type ResolverArgs = unknown[];

const TIMEOUT = 30e3;
const RETRY_TIMES = 3;

// A single test input. The common case is a bare address/name string. Resolvers
// that take extra positional arguments (chainId, network, ...) pass `{ args }`.
type Input = string | { args: ResolverArgs };

type Config = {
  // Resolver id: drives the resolver lookup and, by default, the snapshot
  // identifiers. Override `resolver` to point at a different resolver, or `subId`
  // to namespace a sub-variant.
  id: ResolverName | string;
  resolver?: ResolverName;
  subId?: string;
  // Addresses that DO resolve to an avatar: one image-snapshot test per input.
  withAvatar?: Input[];
  // Valid addresses with NO avatar set: one false-assertion test per input.
  withoutAvatar?: Input[];
  skip?: boolean;
  requireEnv?: string[];
  todoCases?: string[];
};

const toArgs = (input: Input): ResolverArgs => (typeof input === 'string' ? [input] : input.args);

const call = (resolver: ResolverName, input: Input) =>
  (resolvers[resolver] as (...a: ResolverArgs) => Promise<unknown>)(...toArgs(input));

export default function testResolverImageSnapshots({
  id,
  resolver = id as ResolverName,
  subId,
  withAvatar = [],
  withoutAvatar = [],
  skip = false,
  requireEnv = [],
  todoCases = []
}: Config) {
  jest.retryTimes(RETRY_TIMES);

  const missingEnv = requireEnv.find(key => !process.env[key]);
  if (missingEnv) {
    describe('resolvers', () => it.todo(`is missing ${missingEnv}`));
    return;
  }

  const base = subId ?? id;
  const describeResolver = skip ? describe.skip : describe;

  describeResolver('resolvers', () => {
    describe(base, () => {
      withAvatar.forEach(input => {
        // Single input: the base name is identifier enough. Multiple inputs
        // disambiguate by their first argument (address/name).
        const identifier = withAvatar.length <= 1 ? base : `${base}-${String(toArgs(input)[0])}`;
        it(
          `matches the image snapshot for ${identifier}`,
          async () => {
            await expectResolverImageSnapshot(await call(resolver, input), {
              ...remoteSnapshotOptions,
              customSnapshotIdentifier: identifier
            });
          },
          TIMEOUT
        );
      });

      withoutAvatar.forEach(input => {
        it(
          'returns false when no avatar is set',
          async () => {
            expect(await call(resolver, input)).toBe(false);
          },
          TIMEOUT
        );
      });

      todoCases.forEach(description => it.todo(description));
    });
  });
}
