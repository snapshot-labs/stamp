export function withoutEmptyValues<T>(obj: Record<string, T>) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value)) as Record<
    string,
    NonNullable<T>
  >;
}
