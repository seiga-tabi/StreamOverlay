export function swapBreedingParents<T>(parentA: T | null, parentB: T | null): [T | null, T | null] {
  return [parentB, parentA];
}
