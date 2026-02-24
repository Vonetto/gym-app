const WRKOUT_BASE_URL = "https://api.wrkout.xyz";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });

const proxyWrkout = async (path: string) => {
  const apiKey = Deno.env.get("WRKOUT_API_KEY")?.trim();
  if (!apiKey) {
    return jsonResponse(503, { error: "missing_wrkout_api_key" });
  }

  const response = await fetch(`${WRKOUT_BASE_URL}${path}`, {
    headers: {
      "X-API-Key": apiKey,
    },
  });

  const contentType = response.headers.get("content-type") ?? "application/json; charset=utf-8";
  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: {
      ...corsHeaders,
      "Content-Type": contentType,
    },
  });
};

const getWrkoutPath = (pathname: string) => {
  const marker = "/wrkout/";
  const index = pathname.indexOf(marker);
  if (index === -1) return null;
  return pathname.slice(index + marker.length - 1);
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "GET") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  const url = new URL(request.url);
  const wrkoutPath = getWrkoutPath(url.pathname);
  if (!wrkoutPath) {
    return jsonResponse(404, { error: "not_found" });
  }

  if (wrkoutPath === "/query" || wrkoutPath === "/exercise/query") {
    const name = (url.searchParams.get("name") || "").trim();
    if (!name) {
      return jsonResponse(400, { error: "name_required" });
    }
    const params = new URLSearchParams({
      name,
      limit: url.searchParams.get("limit") || "25",
      lang: url.searchParams.get("lang") || "en-GB",
      searchlang: url.searchParams.get("searchlang") || "en-GB",
    });
    try {
      return await proxyWrkout(`/exercise/query?${params.toString()}`);
    } catch (_error) {
      return jsonResponse(502, { error: "wrkout_unavailable" });
    }
  }

  if (wrkoutPath.startsWith("/exercise/")) {
    const exerciseId = wrkoutPath.slice("/exercise/".length).trim();
    if (!exerciseId || exerciseId === "query") {
      return jsonResponse(404, { error: "not_found" });
    }
    const lang = (url.searchParams.get("lang") || "en-GB").trim();
    try {
      return await proxyWrkout(
        `/exercise/${encodeURIComponent(exerciseId)}?lang=${encodeURIComponent(lang)}`,
      );
    } catch (_error) {
      return jsonResponse(502, { error: "wrkout_unavailable" });
    }
  }

  return jsonResponse(404, { error: "not_found" });
});
