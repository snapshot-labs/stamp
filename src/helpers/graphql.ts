import { withDeadline } from './deadline';
import { httpError } from './errors';
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

export async function graphQlCall<T = any>(
  url: string,
  query: string,
  variables?: Record<string, any>,
  options: any = { headers: {} }
): Promise<{ data: GraphQlResponse<T>; status: number }> {
  const data: { query: string; variables?: Record<string, any> } = { query };
  if (variables) data.variables = variables;

  return withDeadline(async signal => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(
          Object.entries(options.headers).filter(
            ([, value]) => value !== undefined && value !== null
          )
        )
      },
      signal,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error: any = httpError(
        new URL(url).host,
        response.status,
        `status code ${response.status}: ${response.statusText}`
      );
      error.response.data = await response.text().catch(() => undefined);
      throw error;
    }

    const body = (await response.json()) as GraphQlResponse<T>;
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
  }, 5e3);
}
