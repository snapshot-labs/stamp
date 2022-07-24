import axios from 'axios';
import parseDataURL from 'data-urls';
import { getAddress } from '@ethersproject/address';
import { Contract } from '@ethersproject/contracts';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { getUrl, resize } from '../utils';
import { max } from '../constants.json';

const provider = new StaticJsonRpcProvider('https://brovider.xyz/1');

const abis = {
  erc721: ['function tokenURI(uint256 tokenId) view returns (string)'],
  erc1155: ['function uri(uint256 id) view returns (string)']
};

async function resolveErc721(address: string, tokenId: string) {
  const contract = new Contract(getAddress(address), abis.erc721, provider);
  const data = await contract.tokenURI(tokenId);

  const parsedMetadata = parseDataURL(data);

  let metadata;
  if (parsedMetadata && parsedMetadata.mimeType.toString() === 'application/json') {
    metadata = JSON.parse(Buffer.from(parsedMetadata.body).toString('utf-8'));
  } else {
    const url = getUrl(data);
    metadata = (await axios.get(url)).data;
  }

  if (!metadata.image) {
    throw new Error('Image not found');
  }

  const parsedImage = parseDataURL(metadata.image);
  if (parsedImage) {
    return Buffer.from(parsedImage.body);
  }

  const url = getUrl(metadata.image);
  return (await axios({ url, responseType: 'arraybuffer' })).data as Buffer;
}

async function resolveErc1155(address: string, tokenId: string) {
  const contract = new Contract(getAddress(address), abis.erc1155, provider);
  const data = await contract.uri(tokenId);

  const replacementId =
    tokenId.length === 64
      ? tokenId
      : BigInt(tokenId)
          .toString(16)
          .padStart(64, '0');

  const parsedMetadata = parseDataURL(data);

  let metadataString;
  if (parsedMetadata && parsedMetadata.mimeType.toString() === 'application/json') {
    metadataString = Buffer.from(parsedMetadata.body).toString('utf-8');
  } else {
    const uniqueData = data.replaceAll('{id}', replacementId);
    const url = getUrl(uniqueData);
    metadataString = JSON.stringify((await axios.get(url)).data);
  }

  const metadata = JSON.parse(metadataString.replaceAll('{id}', replacementId));

  if (!metadata.image) {
    throw new Error('Image not found');
  }

  const parsedImage = parseDataURL(metadata.image);
  if (parsedImage) {
    return Buffer.from(parsedImage.body);
  }

  const url = getUrl(metadata.image);
  return (await axios({ url, responseType: 'arraybuffer' })).data as Buffer;
}

export default async function resolve(address: string, tokenId: string) {
  try {
    const input = await Promise.any([
      resolveErc721(address, tokenId),
      resolveErc1155(address, tokenId)
    ]);

    return await resize(input, max, max, 'contain');
  } catch (e) {
    return false;
  }
}
