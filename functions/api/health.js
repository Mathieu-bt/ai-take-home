export async function onRequestGet(context) {
  const model = context.env.GEMINI_MODEL || "gemini-2.0-flash";
  const hasApiKey = Boolean(context.env.GEMINI_API_KEY);
  return Response.json({
    ok: true,
    runtime: "cloudflare-pages-functions",
    gemini_model: model,
    has_api_key: hasApiKey,
  });
}
