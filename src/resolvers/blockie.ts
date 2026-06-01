import { renderIcon } from '@download/blockies';
import { createCanvas } from 'canvas';
import { max } from '../constants.json';
import { resize } from '../utils';

export default async function resolve(address) {
  const canvas = createCanvas(64, 64);
  renderIcon({ seed: address, scale: 64 }, canvas);
  const input = canvas.toBuffer();
  return await resize(input, max, max);
}
