import resolvers from '../../../src/resolvers';
import { remoteSnapshotOptions } from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

type ResolverName = keyof typeof resolvers;

type ResolverArgs = unknown[];

const DEFAULT_TIMEOUT = 30e3;

// A single test input. The common case is a bare address/name string. Resolvers
// that take extra positional arguments (chainId, network, ...) pass a richer
// object. The snapshot identifier is derived from the resolver id and the
// input; `timeout` is derived internally when omitted.
type Input =
  | string
  | {
      args: ResolverArgs;
      timeout?: number;
    };

type LegacyEqualityCase = {
  args: ResolverArgs;
  legacyArgs: ResolverArgs;
  timeout?: number;
};

type ResolverGroup = {
  resolver?: ResolverName;
  id?: string;
  withAvatar?: Input[];
  withoutAvatar?: Input[];
  legacyEqualityCases?: LegacyEqualityCase[];
  todoCases?: string[];
};

type Config = {
  // Resolver id: drives the resolver lookup, the describe block and the
  // generated snapshot identifiers.
  id: ResolverName | string;
  resolver?: ResolverName;
  // Addresses that DO resolve to an avatar image: one happy-path snapshot test
  // per input.
  withAvatar?: Input[];
  // Valid addresses with NO avatar set: one false-assertion test per input.
  withoutAvatar?: Input[];
  skip?: boolean;
  requireEnv?: string[];
  retryTimes?: number;
  legacyEqualityCases?: LegacyEqualityCase[];
  todoCases?: string[];
  groups?: ResolverGroup[];
};

const call = (resolver: ResolverName, args: ResolverArgs) =>
  (resolvers[resolver] as (...a: ResolverArgs) => Promise<unknown>)(...args);

const toArgs = (input: Input): ResolverArgs => (typeof input === 'string' ? [input] : input.args);

const toTimeout = (input: Input): number =>
  typeof input === 'string' ? DEFAULT_TIMEOUT : (input.timeout ?? DEFAULT_TIMEOUT);

function snapshotIdentifier(input: Input, id: string, total: number): string {
  // Single happy-path input: the resolver id is identifier enough. Multiple
  // inputs disambiguate by their first argument (address/name), keeping the
  // identifier deterministic and tied to the input rather than its position.
  if (total <= 1) return id;
  return `${id}-${String(toArgs(input)[0])}`;
}

function buildGroup(group: ResolverGroup, fallback: ResolverName) {
  const {
    resolver = fallback,
    id = resolver,
    withAvatar = [],
    withoutAvatar = [],
    legacyEqualityCases = [],
    todoCases = []
  } = group;

  describe(id, () => {
    withAvatar.forEach(input => {
      const identifier = snapshotIdentifier(input, id, withAvatar.length);
      it(
        `matches the image snapshot for ${identifier}`,
        async () => {
          await expectResolverImageSnapshot(await call(resolver, toArgs(input)), {
            ...remoteSnapshotOptions,
            customSnapshotIdentifier: identifier
          });
        },
        toTimeout(input)
      );
    });

    withoutAvatar.forEach(input => {
      it(
        'returns false when no avatar is set',
        async () => {
          expect(await call(resolver, toArgs(input))).toBe(false);
        },
        toTimeout(input)
      );
    });

    legacyEqualityCases.forEach(({ args, legacyArgs, timeout }) => {
      it(
        'returns the same result for the legacy and non-legacy format',
        async () => {
          expect(await call(resolver, args)).toEqual(await call(resolver, legacyArgs));
        },
        timeout
      );
    });

    todoCases.forEach(description => {
      it.todo(description);
    });
  });
}

export default function testResolverImageSnapshots(config: Config) {
  const {
    id,
    resolver = id as ResolverName,
    withAvatar,
    withoutAvatar,
    skip = false,
    requireEnv = [],
    retryTimes,
    legacyEqualityCases,
    todoCases,
    groups
  } = config;

  if (typeof retryTimes === 'number') {
    jest.retryTimes(retryTimes);
  }

  const missingEnv = requireEnv.find(key => !process.env[key]);
  if (missingEnv) {
    describe('resolvers', () => {
      it.todo(`is missing ${missingEnv}`);
    });
    return;
  }

  const resolvedGroups: ResolverGroup[] = groups ?? [
    { resolver, id, withAvatar, withoutAvatar, legacyEqualityCases, todoCases }
  ];

  const describeResolver = skip ? describe.skip : describe;

  describeResolver('resolvers', () => {
    resolvedGroups.forEach(group => buildGroup(group, resolver));
  });
}
