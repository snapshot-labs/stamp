export function rpcSuccess(res, result, id) {
  res.json({
    jsonrpc: '2.0',
    result,
    id
  });
}

export function rpcError(res, code, e, id, message = 'unauthorized') {
  res.status(code).json({
    jsonrpc: '2.0',
    error: {
      code,
      message,
      data: e
    },
    id
  });
}

// JSON-RPC "Invalid params" error (-32602) with HTTP 400; `data` carries a
// human readable summary.
export function rpcInvalidParams(res, data, id) {
  res.status(400).json({
    jsonrpc: '2.0',
    error: {
      code: -32602,
      message: 'invalid params',
      data
    },
    id
  });
}
