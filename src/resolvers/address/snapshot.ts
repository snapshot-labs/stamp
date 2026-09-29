import { graphQlCall } from '../../helpers/graphql';
import { withoutEmptyValues } from '../../helpers/object';
import { Address, Handle } from '../../helpers/types';

const HUB_URL = process.env.HUB_URL ?? 'https://hub.snapshot.org';
export const NAME = 'Snapshot';

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const {
    data: { users }
  } = await graphQlCall<{ users: { id: string; name: string | null }[] }>(
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

  return withoutEmptyValues(Object.fromEntries(users.map(user => [user.id, user.name])));
}

export async function resolveNames(): Promise<Record<Handle, Address>> {
  return {};
}
