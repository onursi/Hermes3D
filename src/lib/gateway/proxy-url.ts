import type { StudioGatewayAdapterType } from "@/lib/studio/settings";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Adapter types whose upstream speaks a different wire protocol than the
 * Hermes3D gateway "hello" handshake and therefore MUST be translated
 * server-side (see server/gateway-proxy.js EMBEDDED_ADAPTER_TYPE) — a direct
 * browser connection to the upstream can never work for these, loopback or
 * not, so the loopback passthrough below must never apply to them.
 */
const EMBEDDED_TRANSLATION_ADAPTER_TYPES = new Set<StudioGatewayAdapterType>(["hermes-agent"]);

export const resolveStudioProxyGatewayUrl = (
  upstreamGatewayUrl?: string,
  adapterType?: StudioGatewayAdapterType
): string => {
  const raw = typeof upstreamGatewayUrl === "string" ? upstreamGatewayUrl.trim() : "";
  const needsEmbeddedTranslation = adapterType
    ? EMBEDDED_TRANSLATION_ADAPTER_TYPES.has(adapterType)
    : false;
  if (raw && !needsEmbeddedTranslation) {
    try {
      const parsed = new URL(raw);
      if (LOOPBACK_HOSTS.has(parsed.hostname)) {
        return raw;
      }
    } catch {
      // Fall through to the Studio proxy for malformed or non-URL values.
    }
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  // Windows can resolve localhost to ::1 while this isolated test server is
  // intentionally bound to IPv4 only. Keep the browser-side proxy on the
  // same explicit IPv4 loopback address used to launch Studio.
  const host =
    window.location.hostname === "localhost"
      ? `127.0.0.1${window.location.port ? `:${window.location.port}` : ""}`
      : window.location.host;
  return `${protocol}://${host}/api/gateway/ws`;
};

