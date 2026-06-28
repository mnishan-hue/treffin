export * from "./generated/api";
export * from "./generated/api.schemas";
export { setBaseUrl, setAuthTokenGetter, setGlobalHeaders, customFetch } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";
export { useIsMobile } from "./use-mobile";
