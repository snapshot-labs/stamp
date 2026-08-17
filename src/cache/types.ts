export type CachePolicy = {
  maxTtl: number;
  cacheEmpty: boolean;
};

export interface CacheStore {
  get(key: string): Promise<string | undefined>;
  getMany(keys: string[]): Promise<Record<string, string>>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  setMany(values: Record<string, string>, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
}
