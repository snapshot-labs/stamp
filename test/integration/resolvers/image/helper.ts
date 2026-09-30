import { MatchImageSnapshotOptions } from 'jest-image-snapshot';
import resolvers from '../../../../src/resolvers/image';
import { expectResolverImageSnapshot } from '../../../helpers/imageSnapshot';
import { recordResolverFailures } from '../../../helpers/resolverFailures';

type ResolverName = keyof typeof resolvers;

type ResolverArgs = unknown[];

const failures = recordResolverFailures();

const TIMEOUT = 30e3;

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
  snapshotOptions?: MatchImageSnapshotOptions;
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
  todoCases = [],
  snapshotOptions
}: Config) {
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
        it.concurrent(
          `matches the image snapshot for ${identifier}`,
          async () => {
            await expectResolverImageSnapshot(await call(resolver, input), {
              ...snapshotOptions,
              customSnapshotIdentifier: identifier
            });
          },
          TIMEOUT
        );
      });

      withoutAvatar.forEach(input => {
        it.concurrent(
          'returns false when no avatar is set',
          async () => {
            expect(await call(resolver, input)).toBe(false);
            expect(failures()).toEqual([]);
          },
          TIMEOUT
        );
      });

      todoCases.forEach(description => it.todo(description));
    });
  });
}
