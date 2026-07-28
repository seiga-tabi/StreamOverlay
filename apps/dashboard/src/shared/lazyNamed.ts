import {
  lazy,
  type ComponentType,
  type LazyExoticComponent,
} from "react";

type NamedComponent<T> = T extends ComponentType<infer Props>
  ? ComponentType<Props>
  : never;

export function lazyNamed<
  Module,
  Name extends keyof Module,
>(
  loadModule: () => Promise<Module>,
  name: Name,
): LazyExoticComponent<NamedComponent<Module[Name]>> {
  return lazy(async () => {
    const module = await loadModule();
    return {
      default: module[name] as NamedComponent<Module[Name]>,
    };
  });
}
