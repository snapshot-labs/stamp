import { capture } from '@snapshot-labs/snapshot-sentry';
import { Address, graphQlCall, Handle } from '../utils';
import { FetchError, isSilencedError } from './utils';

const HUB_URL = process.env.HUB_URL ?? 'https://hub.snapshot.org';
export const NAME = 'Snapshot';

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  try {
    const {
      data: {
        data: { users }
      }
    } = await graphQlCall(
      `${HUB_URL}/graphql`,
      `query users($addresses: [String!]!) {
        users(where: {id_in: $addresses}) {
          id
          name
        }
      }`,
      { addresses },
      {
        headers: { 'x-api-key': process.env.HUB_API_KEY }
      }
    );

    return Object.fromEntries(
      users.filter((user: any) => user.name).map((user: any) => [user.id, user.name])
    );
  } catch (err) {
    if (!isSilencedError(err)) {
      capture(err, { input: { addresses } });
    }
    throw new FetchError();
  }
}

export async function resolveNames(): Promise<Record<Handle, Address>> {
  return {};
}
