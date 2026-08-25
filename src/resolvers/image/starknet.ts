import { byteArray, CallData, constants, shortString, starknetId } from 'starknet';
import { isStarkDomain, isStarknetFelt } from '../../helpers/address';
import { untilAborted, withDeadline } from '../../helpers/deadline';
import { fetchHttpImage, fetchWithDeadline, getUrl } from '../../helpers/http';
import { getProvider } from '../../helpers/provider';

const DEFAULT_IMG_URL = 'https://starknet.id/api/identicons/0';
const CHAIN_ID = constants.StarknetChainId.SN_MAIN;
const provider = getProvider(CHAIN_ID);

function isUnsupportedTokenUriError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('starknetid/multicall-failed') && message.includes('ENTRYPOINT_NOT_FOUND')
  );
}

async function getNftProfilePicture(address: string): Promise<string | null> {
  const starknetIdContract = starknetId.getStarknetIdContract(CHAIN_ID);
  const identityContract = starknetId.getStarknetIdIdentityContract(CHAIN_ID);
  const pfpContract = starknetId.getStarknetIdPfpContract(CHAIN_ID);

  const domain = await provider.callContract({
    contractAddress: starknetIdContract,
    entrypoint: 'address_to_domain',
    calldata: CallData.compile({ address, hint: [] })
  });
  const id = await provider.callContract({
    contractAddress: starknetIdContract,
    entrypoint: 'domain_to_id',
    calldata: domain
  });
  const nftContract = await provider.callContract({
    contractAddress: identityContract,
    entrypoint: 'get_verifier_data',
    calldata: CallData.compile({
      token_id: id[0],
      field: shortString.encodeShortString('nft_pp_contract'),
      verifier: pfpContract,
      domain: 0
    })
  });

  if (!nftContract[0] || nftContract[0] === '0x0') return null;

  const nftId = await provider.callContract({
    contractAddress: identityContract,
    entrypoint: 'get_extended_verifier_data',
    calldata: CallData.compile({
      token_id: id[0],
      field: shortString.encodeShortString('nft_pp_id'),
      extended_data_length: 2,
      verifier: pfpContract,
      domain: 0
    })
  });
  const metadata = await provider.callContract({
    contractAddress: nftContract[0],
    entrypoint: 'token_uri',
    calldata: nftId.slice(1, 3)
  });

  return decodeTokenUri(metadata);
}

// `token_uri` replies as [len, ...felts] (Cairo 0 Array<felt252>) or as
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
    return (await provider.getStarkProfile(address))?.profilePicture ?? null;
  } catch (err) {
    if (!isUnsupportedTokenUriError(err)) throw err;

    try {
      return await withDeadline(signal => untilAborted(signal, getNftProfilePicture(address)));
    } catch (fallbackErr) {
      if (fallbackErr instanceof Error) fallbackErr.cause = err;
      throw fallbackErr;
    }
  }
}

function fetchImageOrMetadata(url: string): Promise<Buffer | { image?: string }> {
  return fetchWithDeadline(url, async response =>
    response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : Buffer.from(await response.arrayBuffer())
  );
}

async function fetchMetadataImage(image: string): Promise<Buffer | null> {
  const url = getUrl(image);
  return url ? fetchHttpImage(url) : null;
}

export default async function resolve(domainOrAddress: string) {
  const img_url = await getImage(domainOrAddress);

  if (!img_url || img_url === DEFAULT_IMG_URL) return false;

  const url = getUrl(img_url);
  if (!url) return false;

  const fetched = await fetchImageOrMetadata(url);
  const buffer = Buffer.isBuffer(fetched)
    ? fetched
    : fetched.image
      ? await fetchMetadataImage(fetched.image)
      : null;

  return buffer ?? false;
}
