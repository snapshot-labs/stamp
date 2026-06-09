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
  description: string;
  args: ResolverArgs;
  identifier: string;
  tolerant?: boolean;
  timeout?: number;
};

export default function testResolverImageSnapshots({
  name,
  resolver = name as ResolverName,
  describeName = name,
  skip = false,
  falseCases = [],
  snapshotCases = []
}: {
  name: string;
  resolver?: ResolverName;
  describeName?: string;
  skip?: boolean;
  falseCases?: FalseCase[];
  snapshotCases?: SnapshotCase[];
}) {
  const call = (args: ResolverArgs) =>
    (resolvers[resolver] as (...a: ResolverArgs) => Promise<unknown>)(...args);

  const describeResolver = skip ? describe.skip : describe;

  describeResolver('resolvers', () => {
    describe(describeName, () => {
      falseCases.forEach(({ description, args, timeout }) => {
        it(
          description,
          async () => {
            expect(await call(args)).toBe(false);
          },
          timeout
        );
      });

      snapshotCases.forEach(({ description, args, identifier, tolerant, timeout }) => {
        it(
          description,
          async () => {
            await expectResolverImageSnapshot(await call(args), {
              ...(tolerant ? remoteSnapshotOptions : {}),
              customSnapshotIdentifier: identifier
            });
          },
          timeout
        );
      });
    });
  });
}
