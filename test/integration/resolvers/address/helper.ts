export default function testAddressResolver({
  name,
  lookupAddresses,
  resolveNames,
  validAddress,
  validDomain,
  blankAddress,
  invalidDomains
}) {
  describe(`${name} address resolver`, () => {
    describe('lookupAddresses()', () => {
      describe('when the address is associated to a domain', () => {
        it('returns the domain associated to the address', async () => {
          return expect(lookupAddresses([validAddress])).resolves.toEqual({
            [validAddress]: validDomain
          });
        }, 10e3);
      });

      describe('when the address is not associated to a domain', () => {
        it('returns an empty object', () => {
          return expect(lookupAddresses([blankAddress])).resolves.toEqual({});
        }, 10e3);
      });

      describe('when mix of addresses with and without associated domains', () => {
        it('returns an object with only addresses associated to a domain', () => {
          return expect(lookupAddresses([validAddress, blankAddress])).resolves.toEqual({
            [validAddress]: validDomain
          });
        }, 10e3);
      });
    });

    describe('resolveNames()', () => {
      if (!resolveNames) {
        it.todo('missing tests for resolveNames()');
      } else {
        describe('when the domain is associated to an address', () => {
          it('returns an address', () => {
            return expect(resolveNames([validDomain])).resolves.toEqual({
              [validDomain]: validAddress
            });
          }, 10e3);
        });

        describe('when the domain is not associated to an address', () => {
          it('returns undefined', () => {
            return expect(resolveNames(['test.snapshotdomain'])).resolves.toEqual({});
          }, 10e3);
        });

        describe('when mix of domains with and without associated address', () => {
          it('returns an object with only handles associated to an address', () => {
            return expect(resolveNames([...invalidDomains, validDomain])).resolves.toEqual({
              [validDomain]: validAddress
            });
          }, 10e3);
        });
      }
    });
  });
}
