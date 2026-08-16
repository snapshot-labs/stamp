export type Address = string;
export type Handle = string;
export type ResolverType =
  | 'avatar'
  | 'user-cover'
  | 'token'
  | 'space'
  | 'space-cover'
  | 'space-logo'
  | 'space-sx'
  | 'space-cover-sx'
  | 'address'
  | 'name';

export type GraphQlResponse<T = any> = {
  data: T;
  errors?: { message?: string }[];
};
