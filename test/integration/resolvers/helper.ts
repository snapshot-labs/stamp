import resolvers from '../../../src/resolvers';
import { remoteSnapshotOptions } from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

type ResolverName = keyof typeof resolvers;

type ResolverArgs = unknown[];

type FalseCase = {
  description: string;
  args: ResolverArgs;
  timeout?: number;
};

type SnapshotCase = {
  args: ResolverArgs;
  identifier: string;
  tolerant?: boolean;
  timeout?: number;
};

type LegacyEqualityCase = {
  description: string;
  args: ResolverArgs;
  legacyArgs: ResolverArgs;
  timeout?: number;
};

type SnapshotAddresses = {
  addresses: readonly string[];
  identifier?: (address: string) => string;
  tolerant?: boolean;
  timeout?: number;
};

type ResolverGroup = {
  resolver?: ResolverName;
  describeName?: string;
  falseCases?: FalseCase[];
  snapshotCases?: SnapshotCase[];
  snapshotAddresses?: SnapshotAddresses;
  legacyEqualityCases?: LegacyEqualityCase[];
  todoCases?: string[];
};

type Config = {
  name: string;
  resolver?: ResolverName;
  describeName?: string;
  skip?: boolean;
  requireEnv?: string[];
  retryTimes?: number;
  falseCases?: FalseCase[];
  snapshotCases?: SnapshotCase[];
  snapshotAddresses?: SnapshotAddresses;
  legacyEqualityCases?: LegacyEqualityCase[];
  todoCases?: string[];
  groups?: ResolverGroup[];
};

const call = (resolver: ResolverName, args: ResolverArgs) =>
  (resolvers[resolver] as (...a: ResolverArgs) => Promise<unknown>)(...args);

function buildGroup(group: ResolverGroup, fallbackResolver: ResolverName) {
  const {
    resolver = fallbackResolver,
    describeName = resolver,
    falseCases = [],
    snapshotCases = [],
    snapshotAddresses,
    legacyEqualityCases = [],
    todoCases = []
  } = group;

  const allSnapshotCases: SnapshotCase[] = [
    ...snapshotCases,
    ...(snapshotAddresses
      ? snapshotAddresses.addresses.map(address => ({
          args: [address] as ResolverArgs,
          identifier: (snapshotAddresses.identifier ?? (a => `${resolver}-${a}`))(address),
          tolerant: snapshotAddresses.tolerant,
          timeout: snapshotAddresses.timeout
        }))
      : [])
  ];

  describe(describeName, () => {
    falseCases.forEach(({ description, args, timeout }) => {
      it(
        description,
        async () => {
          expect(await call(resolver, args)).toBe(false);
        },
        timeout
      );
    });

    allSnapshotCases.forEach(({ args, identifier, tolerant, timeout }) => {
      it(
        `matches the image snapshot for ${identifier}`,
        async () => {
          await expectResolverImageSnapshot(await call(resolver, args), {
            ...(tolerant ? remoteSnapshotOptions : {}),
            customSnapshotIdentifier: identifier
          });
        },
        timeout
      );
    });

    legacyEqualityCases.forEach(({ description, args, legacyArgs, timeout }) => {
      it(
        description,
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
    name,
    resolver = name as ResolverName,
    describeName = name,
    skip = false,
    requireEnv = [],
    retryTimes,
    falseCases,
    snapshotCases,
    snapshotAddresses,
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
    {
      resolver,
      describeName,
      falseCases,
      snapshotCases,
      snapshotAddresses,
      legacyEqualityCases,
      todoCases
    }
  ];

  const describeResolver = skip ? describe.skip : describe;

  describeResolver('resolvers', () => {
    resolvedGroups.forEach(group => buildGroup(group, resolver));
  });
}
