import sharp from 'sharp';
import { max } from '../../constants.json';
import { resize } from '../../utils';

// Xorshift PRNG, color and grid logic ported verbatim from @download/blockies
// (src/blockies.mjs) so the generated identicons stay visually identical to the
// previous node-canvas based implementation. Only the canvas rasterisation is
// replaced: instead of painting rects onto a canvas we emit an equivalent SVG
// and let sharp turn it into a webp.
const randseed = new Array(4);

function seedrand(seed: string) {
  randseed.fill(0);

  for (let i = 0; i < seed.length; i++) {
    randseed[i % 4] = (randseed[i % 4] << 5) - randseed[i % 4] + seed.charCodeAt(i);
  }
}

function rand() {
  const t = randseed[0] ^ (randseed[0] << 11);

  randseed[0] = randseed[1];
  randseed[1] = randseed[2];
  randseed[2] = randseed[3];
  randseed[3] = randseed[3] ^ (randseed[3] >> 19) ^ t ^ (t >> 8);

  return (randseed[3] >>> 0) / ((1 << 31) >>> 0);
}

function createColor() {
  const h = Math.floor(rand() * 360);
  const s = `${rand() * 60 + 40}%`;
  const l = `${(rand() + rand() + rand() + rand()) * 25}%`;

  return `hsl(${h},${s},${l})`;
}

function createImageData(size: number) {
  const width = size;
  const height = size;

  const dataWidth = Math.ceil(width / 2);
  const mirrorWidth = width - dataWidth;

  const data: number[] = [];
  for (let y = 0; y < height; y++) {
    let row: number[] = [];
    for (let x = 0; x < dataWidth; x++) {
      row[x] = Math.floor(rand() * 2.3);
    }
    const r = row.slice(0, mirrorWidth);
    r.reverse();
    row = row.concat(r);

    for (let i = 0; i < row.length; i++) {
      data.push(row[i]);
    }
  }

  return data;
}

function renderSvg(seed: string, size: number, scale: number) {
  seedrand(seed);

  // The call order (color, bgcolor, spotcolor) must match buildOpts in
  // @download/blockies, otherwise the PRNG stream diverges and the output
  // changes.
  const color = createColor();
  const bgcolor = createColor();
  const spotcolor = createColor();

  const imageData = createImageData(size);
  const width = Math.sqrt(imageData.length);
  const dimension = size * scale;

  const rects: string[] = [];
  for (let i = 0; i < imageData.length; i++) {
    if (imageData[i]) {
      const row = Math.floor(i / width);
      const col = i % width;
      const fill = imageData[i] === 1 ? color : spotcolor;

      rects.push(
        `<rect x="${col * scale}" y="${row * scale}" width="${scale}" height="${scale}" fill="${fill}"/>`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}" shape-rendering="crispEdges"><rect width="${dimension}" height="${dimension}" fill="${bgcolor}"/>${rects.join(
    ''
  )}</svg>`;
}

export default async function resolve(address) {
  const svg = renderSvg(address, 8, 64);
  const input = await sharp(Buffer.from(svg, 'utf-8')).png().toBuffer();

  return await resize(input, max, max);
}
