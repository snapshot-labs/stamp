export function rpcSuccess(res, result, id) {
  res.json({
    jsonrpc: '2.0',
    result,
    id
  });
}

export function rpcError(res, code, e, id) {
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

export function rpcInvalidParams(res, data, id) {
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
