import { Response } from 'express';

export function rpcSuccess(res: Response, result: unknown, id: unknown) {
  res.json({
    jsonrpc: '2.0',
    result,
    id
  });
}

export function rpcError(res: Response, code: number, e: unknown, id: unknown) {
  res.status(code).json({
    jsonrpc: '2.0',
    error: {
      code,
      message: 'unauthorized',
      data: e
    },
    id
  });
}

export function rpcInvalidParams(res: Response, data: unknown, id: unknown) {
  res.status(400).json({
    jsonrpc: '2.0',
    error: {
      code: -32602,
      message: 'Invalid params',
      data
    },
    id
  });
}
