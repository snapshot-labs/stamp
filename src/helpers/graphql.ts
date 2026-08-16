import axios, { AxiosResponse } from 'axios';
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
): Promise<AxiosResponse<GraphQlResponse<T>>> {
  const data: { query: string; variables?: Record<string, any> } = { query };
  if (variables) data.variables = variables;

  const response: AxiosResponse<GraphQlResponse<T>> = await axios({
    url,
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      ...Object.fromEntries(
        Object.entries(options.headers).filter(([, value]) => value !== undefined && value !== null)
      )
    },
    timeout: 5e3,
    data
  });

  const body = response.data;
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
  return response;
}
