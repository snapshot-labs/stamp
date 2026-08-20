import { httpError } from './errors';
import { fetchHttpResponse } from './http';
import { GraphQlResponse } from './types';

function graphQlEnvelopeError(url: string, status: number, message: string) {
  let source = url;
  try {
    source = new URL(url).host;
  } catch {
    // Not an absolute url; keep the whole string as the source.
  }

  return httpError(source, status, message);
}

function parseGraphQlResponse(body: string): any {
  const decoded = body.charCodeAt(0) === 0xfeff ? body.slice(1) : body;
  try {
    return JSON.parse(decoded);
  } catch {
    return body;
  }
}

export async function graphQlCall<T = any>(
  url: string,
  query: string,
  variables?: Record<string, any>,
  options: any = { headers: {} }
): Promise<{ data: GraphQlResponse<T>; status: number }> {
  const data: { query: string; variables?: Record<string, any> } = { query };
  if (variables) data.variables = variables;

  const { response, body: responseBody } = await fetchHttpResponse(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...Object.fromEntries(
        Object.entries(options.headers).filter(([, value]) => value !== undefined && value !== null)
      )
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error: any = graphQlEnvelopeError(
      url,
      response.status,
      `status code ${response.status}: ${response.statusText}`
    );
    error.response.data = responseBody.toString();
    throw error;
  }

  const body = parseGraphQlResponse(responseBody.toString());

  if (body?.errors?.length) {
    throw graphQlEnvelopeError(
      url,
      response.status,
      body.errors[0]?.message || 'GraphQL request failed'
    );
  }
  if (!body?.data) {
    throw graphQlEnvelopeError(url, response.status, 'GraphQL response has no data envelope');
  }
  return { data: body, status: response.status };
}
