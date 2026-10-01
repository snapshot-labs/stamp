import fs from 'fs/promises';

type Chain = {
  chainId: number;
  shortName: string;
};

const CUSTOM_CHAINS = [
  // Polygon - Using old shortname for compatibility
  ['137', 'matic'],
  // SN_MAIN
  ['0x534e5f4d41494e', 'sn'],
  // SN_SEPOLIA
  ['0x534e5f5345504f4c4941', 'sn-sep']
];

async function generateChains() {
  if (process.argv.length < 3) {
    console.log('Usage: yarn generate-chains <path-to-chains.json>');
    process.exit(1);
  }

  console.log('Generating chains.json...');

  const inputData = await fs.readFile(process.argv[2], 'utf-8');
  const chains: Chain[] = JSON.parse(inputData);

  const CHAIN_ID_TO_SHORTNAME = [
    ...chains.map(chain => [String(chain.chainId), chain.shortName.toLowerCase()]),
    ...CUSTOM_CHAINS
  ];

  const output = {
    CHAIN_ID_TO_SHORTNAME: CHAIN_ID_TO_SHORTNAME.reduce(
      (acc, chain) => {
        acc[chain[0]] = chain[1];
        return acc;
      },
      {} as Record<string, string>
    ),
    SHORTNAME_TO_CHAIN_ID: CHAIN_ID_TO_SHORTNAME.reduce(
      (acc, chain) => {
        acc[chain[1]] = chain[0];
        return acc;
      },
      {} as Record<string, string>
    )
  };

  await fs.writeFile('src/chains.json', JSON.stringify(output, null, 2));
}

generateChains();
