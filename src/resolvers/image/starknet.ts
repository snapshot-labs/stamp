import { byteArray, CallData, constants, hash, shortString, starknetId } from 'starknet';
import { isStarkDomain, isStarknetFelt } from '../../helpers/address';
import { httpError } from '../../helpers/errors';
import { fetchHttpImage, getUrl } from '../../helpers/http';
import { getProvider } from '../../helpers/provider';

const IDENTICON_URL = 'https://starknet.id/api/identicons/';
const DEFAULT_IMG_URL = `${IDENTICON_URL}0`;
const CHAIN_ID = constants.StarknetChainId.SN_MAIN;
const provider = getProvider(CHAIN_ID);

function isUnsupportedTokenUriError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('starknetid/multicall-failed') && message.includes('ENTRYPOINT_NOT_FOUND')
  );
}

// starknet.js's getStarkProfile makes this multicall, plus the social fields, but
// decodes every token URI as an Array<felt252>, which appends a stray character
// to a Cairo 1 ByteArray one, and only ever calls tokenURI.
async function getProfilePicture(
  address: string,
  entrypoint: 'tokenURI' | 'token_uri'
): Promise<string | null> {
  const { dynamicCallData, dynamicFelt, execution } = starknetId;
  const naming = starknetId.getStarknetIdContract(CHAIN_ID);
  const identity = starknetId.getStarknetIdIdentityContract(CHAIN_ID);
  const pfp = starknetId.getStarknetIdPfpContract(CHAIN_ID);
  const call = (to: string, name: string, calldata: ReturnType<typeof dynamicCallData>[]) => ({
    execution: execution({}),
    to: dynamicFelt(to),
    selector: dynamicFelt(hash.getSelectorFromName(name)),
    calldata
  });

  // A reference [i, j] is word j of call i's result.
  const data = await provider.callContract({
    contractAddress: starknetId.getStarknetIdMulticallContract(CHAIN_ID),
    entrypoint: 'aggregate',
    calldata: CallData.compile({
      calls: [
        call(naming, 'address_to_domain', [dynamicCallData(address), dynamicCallData('0')]),
        call(naming, 'domain_to_id', [dynamicCallData(undefined, undefined, [0, 0])]),
        call(identity, 'get_verifier_data', [
          dynamicCallData(undefined, [1, 0]),
          dynamicCallData(shortString.encodeShortString('nft_pp_contract')),
          dynamicCallData(pfp),
          dynamicCallData('0')
        ]),
        call(identity, 'get_extended_verifier_data', [
          dynamicCallData(undefined, [1, 0]),
          dynamicCallData(shortString.encodeShortString('nft_pp_id')),
          dynamicCallData('2'),
          dynamicCallData(pfp),
          dynamicCallData('0')
        ]),
        // Skipped when the profile has no NFT contract, leaving four results.
        {
          execution: execution(undefined, undefined, [2, 0, 0]),
          to: dynamicFelt(undefined, [2, 0]),
          selector: dynamicFelt(hash.getSelectorFromName(entrypoint)),
          calldata: [dynamicCallData(undefined, [3, 1]), dynamicCallData(undefined, [3, 2])]
        }
      ]
    })
  });

  // [count, length, ...result, length, ...result, ...]
  const results: string[][] = [];
  for (let i = 1; i < data.length; i += 1 + Number(data[i])) {
    results.push(data.slice(i + 1, i + 1 + Number(data[i])));
  }

  const tokenUri = results[4] && decodeTokenUri(results[4]);

  return tokenUri || `${IDENTICON_URL}${BigInt(results[1][0])}`;
}

// A token URI replies as [len, ...felts] (Cairo 0 Array<felt252>) or as
// [num_full_words, ...full_words, pending_word, pending_word_len] (Cairo 1 ByteArray).
function decodeTokenUri(raw: string[]): string | null {
  const len = Number(raw[0]);

  if (raw.length === 3 + len) {
    return (
      byteArray.stringFromByteArray({
        data: raw.slice(1, 1 + len),
        pending_word: raw[1 + len],
        pending_word_len: raw[2 + len]
      }) || null
    );
  }

  if (raw.length === 1 + len) {
    return raw.slice(1).map(shortString.decodeShortString).join('') || null;
  }

  return null;
}

async function getStarknetAddress(domain: string): Promise<string | null> {
  const address = await provider.getAddressFromStarkName(domain);

  return address === '0x0' ? null : address;
}

async function getImage(domainOrAddress: string): Promise<string | null> {
  const address = isStarkDomain(domainOrAddress)
    ? await getStarknetAddress(domainOrAddress)
    : isStarknetFelt(domainOrAddress)
      ? domainOrAddress
      : null;

  if (!address) return null;

  try {
    return await getProfilePicture(address, 'tokenURI');
  } catch (err) {
    if (!isUnsupportedTokenUriError(err)) throw err;

    try {
      return await getProfilePicture(address, 'token_uri');
    } catch (fallbackErr) {
      if (fallbackErr instanceof Error) fallbackErr.cause = err;
      throw fallbackErr;
    }
  }
}

async function followMetadata(response: Response): Promise<string | undefined> {
  const type = (response.headers.get('content-type') ?? '').toLowerCase().split(';')[0].trim();
  const isJson = type === 'application/json' || type === 'text/json' || type.endsWith('+json');

  if (!response.ok || !isJson) return;

  const body = await response.text();

  try {
    const metadata = JSON.parse(body);
    const url = typeof metadata?.image === 'string' ? getUrl(metadata.image) : undefined;
    if (url) return url;
  } catch {}

  throw httpError('starknet', 404, 'no fetchable image in metadata');
}

export default async function resolve(domainOrAddress: string) {
  const img_url = await getImage(domainOrAddress);

  if (!img_url || img_url === DEFAULT_IMG_URL) return false;

  const url = getUrl(img_url);
  if (!url) return false;

  return fetchHttpImage(url, followMetadata);
}
