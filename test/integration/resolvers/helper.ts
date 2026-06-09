import resolvers from '../../../src/resolvers';
import { remoteSnapshotOptions } from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

type ResolverName = keyof typeof resolvers;

type ResolverArgs = unknown[];

const DEFAULT_TIMEOUT = 30e3;
const DEFAULT_RETRY_TIMES = 3;

// A single test input. The common case is a bare address/name string. Resolvers
// that take extra positional arguments (chainId, network, ...) pass a richer
// object. The snapshot identifier is derived from the resolver id and the
// input.
type Input =
  | string
  | {
      args: ResolverArgs;
    };

type LegacyEqualityCase = {
  args: ResolverArgs;
  legacyArgs: ResolverArgs;
};

type Config = {
  // Resolver id: drives the resolver lookup and, by default, the describe block
  // and the generated snapshot identifiers.
  id: ResolverName | string;
  resolver?: ResolverName;
  // Optional sub-identifier: namespaces the describe block and the derived
  // snapshot identifiers. Lets a single resolver be exercised across several
  // sub-variants by calling testResolverImageSnapshots once per variant, each
  // with its own subId, instead of one call with multiple groups.
  subId?: string;
  // Addresses that DO resolve to an avatar image: one happy-path snapshot test
  // per input.
  withAvatar?: Input[];
  // Valid addresses with NO avatar set: one false-assertion test per input.
  withoutAvatar?: Input[];
  skip?: boolean;
  requireEnv?: string[];
  // Whole-test fields: applied uniformly to every case in this call, like
  // retryTimes.
  timeout?: number;
  retryTimes?: number;
  legacyEqualityCases?: LegacyEqualityCase[];
  todoCases?: string[];
};

const call = (resolver: ResolverName, args: ResolverArgs) =>
  (resolvers[resolver] as (...a: ResolverArgs) => Promise<unknown>)(...args);

const toArgs = (input: Input): ResolverArgs => (typeof input === 'string' ? [input] : input.args);

function snapshotIdentifier(input: Input, base: string, total: number): string {
  // Single happy-path input: the base name is identifier enough. Multiple
  // inputs disambiguate by their first argument (address/name), keeping the
  // identifier deterministic and tied to the input rather than its position.
  if (total <= 1) return base;
  return `${base}-${String(toArgs(input)[0])}`;
}

function buildResolver(
  resolver: ResolverName,
  base: string,
  withAvatar: Input[],
  withoutAvatar: Input[],
  legacyEqualityCases: LegacyEqualityCase[],
  todoCases: string[],
  timeout: number
) {
  describe(base, () => {
    withAvatar.forEach(input => {
      const identifier = snapshotIdentifier(input, base, withAvatar.length);
      it(
        `matches the image snapshot for ${identifier}`,
        async () => {
          await expectResolverImageSnapshot(await call(resolver, toArgs(input)), {
            ...remoteSnapshotOptions,
            customSnapshotIdentifier: identifier
          });
        },
        timeout
      );
    });

    withoutAvatar.forEach(input => {
      it(
        'returns false when no avatar is set',
        async () => {
          expect(await call(resolver, toArgs(input))).toBe(false);
        },
        timeout
      );
    });

    legacyEqualityCases.forEach(({ args, legacyArgs }) => {
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
    subId,
    withAvatar = [],
    withoutAvatar = [],
    skip = false,
    requireEnv = [],
    timeout = DEFAULT_TIMEOUT,
    retryTimes = DEFAULT_RETRY_TIMES,
    legacyEqualityCases = [],
    todoCases = []
  } = config;

  jest.retryTimes(retryTimes);

  const missingEnv = requireEnv.find(key => !process.env[key]);
  if (missingEnv) {
    describe('resolvers', () => {
      it.todo(`is missing ${missingEnv}`);
    });
    return;
  }

  // The describe block and the derived snapshot identifiers are namespaced by
  // subId when present, otherwise by the resolver id.
  const base = subId ?? id;

  const describeResolver = skip ? describe.skip : describe;

  describeResolver('resolvers', () => {
    buildResolver(
      resolver,
      base,
      withAvatar,
      withoutAvatar,
      legacyEqualityCases,
      todoCases,
      timeout
    );
  });
}
