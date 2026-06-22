type StreamOpsRuntimeConfig = {
  wsBase?: string;
};

declare global {
  interface Window {
    __STREAMOPS_CONFIG__?: StreamOpsRuntimeConfig;
  }
}

export function runtimeConfig(): StreamOpsRuntimeConfig {
  return window.__STREAMOPS_CONFIG__ ?? {};
}
