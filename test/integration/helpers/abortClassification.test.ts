import http from 'http';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { createPublicClient, encodeErrorResult, parseAbi, http as viemHttp } from 'viem';
import { isSilencedError } from '../../../src/helpers/errors';

let server: http.Server;
let url: string;
const sockets = new Set<any>();

const address = '0x1111111111111111111111111111111111111111';
const callback = '0x12345678';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/reset') return req.socket.destroy();
    if (req.url === '/rst') return req.socket.resetAndDestroy();
    if (req.url === '/404') return res.writeHead(404).end();
    if (req.url?.startsWith('/gateway/')) {
      return res.writeHead(200, { 'content-type': 'application/json' }).end('{"data":"0x"}');
    }
    if (req.url === '/ccip') {
      // Reverts with OffchainLookup, then resets the callback the gateway answer leads to.
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        const { id, params } = JSON.parse(body);
        if (params[0].data.startsWith(callback)) return req.socket.resetAndDestroy();

        const data = encodeErrorResult({
          abi: parseAbi([
            'error OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData)'
          ]),
          errorName: 'OffchainLookup',
          args: [address, [`${url}gateway/{sender}/{data}`], '0x', callback, '0x']
        });
        res
          .writeHead(200, { 'content-type': 'application/json' })
          .end(
            JSON.stringify({ jsonrpc: '2.0', id, error: { code: 3, message: 'reverted', data } })
          );
      });
      return;
    }

    // Accepts the connection and never answers, so the abort is what ends the request.
  });
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  url = `http://127.0.0.1:${(server.address() as any).port}/`;
});

afterAll(async () => {
  sockets.forEach(socket => socket.destroy());
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe('isSilencedError, on a request we aborted ourselves', () => {
  it('silences an abort raised by fetch', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);

    const error = await fetch(url, { signal: controller.signal }).catch(err => err);

    expect(error.name).toBe('AbortError');
    expect(isSilencedError(error)).toBe(true);
  });
});

describe('isSilencedError, on a peer reset', () => {
  it('silences the native fetch socket error', async () => {
    const error = await fetch(`${url}reset`, { method: 'POST' }).catch(err => err);

    expect(error).toMatchObject({
      name: 'TypeError',
      cause: { code: 'UND_ERR_SOCKET' }
    });
    expect(isSilencedError(error)).toBe(true);
  });
});

describe('isSilencedError, on a peer reset under an RPC library', () => {
  const viemCall = (path: string) =>
    createPublicClient({ transport: viemHttp(`${url}${path}`, { retryCount: 0 }) })
      .readContract({
        address,
        abi: parseAbi(['function f() view returns (uint256)']),
        functionName: 'f'
      })
      .catch(err => err);

  it('silences viem, which nests the socket error four causes down', async () => {
    const error = await viemCall('rst');

    expect(error).toMatchObject({
      cause: { cause: { cause: { cause: { code: 'ECONNRESET' } } } }
    });
    expect(isSilencedError(error)).toBe(true);
  });

  it('silences viem on a CCIP-Read callback, one cause deeper', async () => {
    const error = await viemCall('ccip');

    expect(error).toMatchObject({
      cause: {
        name: 'OffchainLookupError',
        cause: { cause: { cause: { cause: { code: 'ECONNRESET' } } } }
      }
    });
    expect(isSilencedError(error)).toBe(true);
  });

  it('silences ethers, which nests the socket error under serverError', async () => {
    const error = await new StaticJsonRpcProvider({ url: `${url}rst` }, 1)
      .call({ to: address, data: '0x252dba42' })
      .catch(err => err);

    expect(error).toMatchObject({
      code: 'CALL_EXCEPTION',
      error: { serverError: { code: 'ECONNRESET' } }
    });
    expect(isSilencedError(error)).toBe(true);
  });

  it('still reports an RPC 404 viem nests as a status', async () => {
    const error = await viemCall('404');

    expect(error).toMatchObject({ cause: { cause: { status: 404 } } });
    expect(isSilencedError(error)).toBe(false);
  });
});
