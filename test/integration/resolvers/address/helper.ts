export default function testAddressResolver({
  name,
  lookupAddresses,
  resolveNames,
  validAddress,
  validDomain,
  blankAddress,
  invalidDomains
}: {
  name: string;
  lookupAddresses: (addresses: string[]) => Promise<Record<string, string>>;
  resolveNames: ((handles: string[]) => Promise<Record<string, string>>) | null;
  validAddress: string;
  validDomain: string;
  blankAddress: string;
  invalidDomains: string[];
}) {
  // Flat: it.concurrent only runs a describe block's own tests together.
  describe(`${name} address resolver`, () => {
    it.concurrent(
      'lookupAddresses() when the address is associated to a domain returns the domain associated to the address',
      async () => {
        return expect(lookupAddresses([validAddress])).resolves.toEqual({
          [validAddress]: validDomain
        });
      },
      10e3
    );

    it.concurrent(
      'lookupAddresses() when the address is not associated to a domain returns an empty object',
      () => {
        return expect(lookupAddresses([blankAddress])).resolves.toEqual({});
      },
      10e3
    );

    it.concurrent(
      'lookupAddresses() when mix of addresses with and without associated domains returns an object with only addresses associated to a domain',
      () => {
        return expect(lookupAddresses([validAddress, blankAddress])).resolves.toEqual({
          [validAddress]: validDomain
        });
      },
      10e3
    );

    if (!resolveNames) {
      it.todo('resolveNames() missing tests for resolveNames()');
    } else {
      it.concurrent(
        'resolveNames() when the domain is associated to an address returns an address',
        () => {
          return expect(resolveNames([validDomain])).resolves.toEqual({
            [validDomain]: validAddress
          });
        },
        10e3
      );

      it.concurrent(
        'resolveNames() when the domain is not associated to an address returns undefined',
        () => {
          return expect(resolveNames(['test.snapshotdomain'])).resolves.toEqual({});
        },
        10e3
      );

      it.concurrent(
        'resolveNames() when mix of domains with and without associated address returns an object with only handles associated to an address',
        () => {
          return expect(resolveNames([...invalidDomains, validDomain])).resolves.toEqual({
            [validDomain]: validAddress
          });
        },
        10e3
      );
    }
  });
}
