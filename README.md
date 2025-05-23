# Stamp [![codecov](https://codecov.io/gh/snapshot-labs/stamp/branch/master/graph/badge.svg?token=N9IMKE41RA)](https://codecov.io/gh/snapshot-labs/stamp)

Resolve and resize web3 avatar and token images.

### Usage

Simply use a valid Stamp URL to display an avatar:

https://cdn.stamp.fyi/avatar/0xeF8305E140ac520225DAf050e2f71d5fBcC543e7?s=200

```
<img src="https://cdn.stamp.fyi/avatar/0xeF8305E140ac520225DAf050e2f71d5fBcC543e7?s=200" />
```

### URL structure

cdn.stamp.fyi/**{type}**/**{identifier}**?**{params}**  
cdn.stamp.fyi/**avatar**/**0xeF8305E140ac520225DAf050e2f71d5fBcC543e7**?**s=200**

### Type

The type is either avatar or token.

#### Examples

cdn.stamp.fyi/**avatar**/0xeF8305E140ac520225DAf050e2f71d5fBcC543e7  
cdn.stamp.fyi/**token**/0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e

### Identifier

The identifier can be an address (case insensitive), ENS name, CAIP-10, EIP-3770, DID or Starknet domain.

#### Examples

cdn.stamp.fyi/avatar/**0xeF8305E140ac520225DAf050e2f71d5fBcC543e7**  
cdn.stamp.fyi/avatar/**fabien.eth**  
cdn.stamp.fyi/token/**eth:0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e**  
cdn.stamp.fyi/token/**eip155:1:0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e**
cdn.stamp.fyi/avatar/**checkpoint.stark**
cdn.stamp.fyi/avatar/**0x07FF6B17f07c4d83236E3Fc5f94259A19D1Ed41bBCf1822397EA17882E9b038d**

### Params

With the params you can define the size of the image returned. You can also refresh the image cache using **cb** param.

#### Examples

cdn.stamp.fyi/avatar/0xeF8305E140ac520225DAf050e2f71d5fBcC543e7?**s=160**
cdn.stamp.fyi/avatar/0xeF8305E140ac520225DAf050e2f71d5fBcC543e7?**w=160&h=240**
cdn.stamp.fyi/avatar/0xeF8305E140ac520225DAf050e2f71d5fBcC543e7?**cb=1**

### Resolvers

#### [ENS avatar](/src/resolvers/ens.ts)

#### [Lens](/src/resolvers/lens.ts)

#### [Self.ID](/src/resolvers/selfid.ts)

#### [Snapshot](/src/resolvers/snapshot.ts)

#### [TrustWallet Assets Info](/src/resolvers/trustwallet.ts)

#### [Blockie](/src/resolvers/blockie.ts)

#### [Jazzicon](/src/resolvers/jazzicon.ts)

#### [Starknet](/src/resolvers/starknet.ts)

#### [Farcaster](/src/resolvers/farcaster.ts)

### Integrations

#### [Snapshot](http://snapshot.org)

#### [Parcel](https://parcel.money)

#### [Hey](https://hey.xyz)

#### [RSS3](https://rss3.io)

#### [Cirip](https://cirip.io)

#### [Tape](https://tape.xyz)

#### [You?](https://github.com/snapshot-labs/stamp/edit/master/README.md)

### License

[MIT](LICENSE).
