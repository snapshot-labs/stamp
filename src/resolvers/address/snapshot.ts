import { graphQlCall } from '../../helpers/graphql';
import { Address, Handle } from '../../helpers/types';

const HUB_URL = process.env.HUB_URL ?? 'https://hub.snapshot.org';
export const NAME = 'Snapshot';

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
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
}

export async function resolveNames(): Promise<Record<Handle, Address>> {
  return {};
}
