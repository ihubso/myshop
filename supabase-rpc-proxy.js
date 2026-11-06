(function installRpcProxy() {
  if (window._rpcProxyInstalled) return;
  window._rpcProxyInstalled = true;

  // RPCs that don't end in `_secure` but still need the service-role proxy.
  // ⚠️ Keep in sync with PROXYABLE_NON_SECURE in the db-rpc edge function.
const PROXYABLE_NON_SECURE = new Set([
  "get_stock_for_business",
  "get_grouped_subcategories",
  "get_subcategory_analytics",
  "process_supermarket_checkout",
  "check_and_record_device_visit",
]);

  // Actions the server accepts without a session.
  const ANON_RPCS = new Set([
    "check_email_exists_secure",
    "check_username_exists_secure",
    "get_available_usernames_secure",
  ]);

  const FETCH_TIMEOUT_MS = 15000;

  function getEnv() {
    return {
      url:  window.ENV?.MYSHOPSUPABASE_URL,
      anon: window.ENV?.MYSHOPSUPABASE_ANON_KEY,
    };
  }

  async function getFingerprint() {
    try {
      if (typeof getDeviceFingerprint === "function") {
        return await getDeviceFingerprint();
      }
    } catch (e) {
      console.warn("RPC proxy: fingerprint failed:", e.message);
    }
    return "";
  }

  function wrapClient(client) {
    if (!client || client._rpcProxied) return client;

    const originalRpc = client.rpc.bind(client);

    client.rpc = async function (name, params, opts) {
      const shouldProxy =
        typeof name === "string" &&
        (name.endsWith("_secure") || PROXYABLE_NON_SECURE.has(name));

      if (!shouldProxy) {
        return originalRpc(name, params, opts);
      }

      const { url: SB_URL, anon: SB_ANON } = getEnv();
      if (!SB_URL || !SB_ANON) {
        console.warn("RPC proxy: window.ENV not ready, calling RPC directly");
        return originalRpc(name, params, opts);
      }

      const DB_RPC_URL   = `${SB_URL}/functions/v1/db-rpc`;
      const sessionToken = localStorage.getItem("sessionToken") || "";
      const isAnonRpc    = ANON_RPCS.has(name);

      // Short-circuit before we hit the network.
      if (!sessionToken && !isAnonRpc) {
        return {
          data: null,
          error: { message: "No session token available", code: "no_session" },
        };
      }

      const fingerprint = await getFingerprint();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const res = await fetch(DB_RPC_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SB_ANON}`,
          },
          body: JSON.stringify({
            action: name,
            params: params || {},
            sessionToken,
            deviceFingerprint: fingerprint,
          }),
          signal: controller.signal,
        });

        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          return {
            data: null,
            error: {
              message: body.error || `HTTP ${res.status}`,
              code:    body.code  || "proxied_error",
              status:  res.status,
            },
          };
        }

        return { data: body.data, error: null };
      } catch (err) {
        const isAbort = err.name === "AbortError";
        return {
          data: null,
          error: {
            message: isAbort ? "Request timed out" : err.message,
            code:    isAbort ? "timeout" : "network_error",
          },
        };
      } finally {
        clearTimeout(timer);
      }
    };

    client._rpcProxied = true;
    return client;
  }

  if (window._sb) wrapClient(window._sb);

  if (window.supabase?.createClient && !window.supabase._rpcPatched) {
    const origCreate = window.supabase.createClient.bind(window.supabase);
    window.supabase.createClient = function (...args) {
      const c = origCreate(...args);
      return wrapClient(c);
    };
    window.supabase._rpcPatched = true;
  }

  window._wrapSbForRpc = wrapClient;
})();