const MAX_BYTES = 4 * 1024 * 1024;
export function validPhotoHost(value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      (u.hostname === "lh3.googleusercontent.com" ||
        /^lh[0-9]+\.googleusercontent\.com$/.test(u.hostname))
    );
  } catch {
    return false;
  }
}
export async function readLimited(response, limit = MAX_BYTES) {
  const length = Number(response.headers.get("content-length"));
  if (length > limit) throw new Error("Photo too large");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty photo");
  let count = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > limit) throw new Error("Photo too large");
      chunks.push(value);
    }
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw e;
  }
  return Buffer.concat(chunks.map((x) => Buffer.from(x)));
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const fail = (status, message) => res.status(status).json({ error: message });
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return fail(405, "Método não permitido.");
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY)
    return fail(503, "A importação ainda não está disponível.");
  if (!req.headers.authorization?.startsWith("Bearer "))
    return fail(401, "Entre novamente.");
  if (Number(req.headers["content-length"]) > 24576)
    return fail(413, "Solicitação muito grande.");
  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return fail(400, "Solicitação inválida.");
  }
  if (!body || JSON.stringify(body).length > 24576)
    return fail(400, "Solicitação inválida.");
  const { googleToken, sessionId, mediaId } = body;
  if (
    typeof googleToken !== "string" ||
    googleToken.length > 8192 ||
    !googleToken ||
    typeof sessionId !== "string" ||
    !sessionId ||
    sessionId.length > 512 ||
    typeof mediaId !== "string" ||
    !mediaId ||
    mediaId.length > 512
  )
    return fail(400, "Seleção inválida.");
  try {
    // Validate the Supabase session online. Never trust a decoded client JWT alone.
    const userResponse = await fetch(
      process.env.SUPABASE_URL + "/auth/v1/user",
      {
        headers: {
          apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
          Authorization: req.headers.authorization,
        },
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      },
    );
    if (!userResponse.ok) return fail(401, "Entre novamente.");
    const user = await userResponse.json();
    if (!user.id) return fail(401, "Entre novamente.");
    const headers = { Authorization: `Bearer ${googleToken}` };
    const session = await fetch(
      `https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(sessionId)}`,
      { headers, signal: AbortSignal.timeout(10000), redirect: "error" },
    );
    if (!session.ok || !(await session.json()).mediaItemsSet)
      return fail(403, "Conclua a seleção no Google Fotos.");
    let pageToken, selected;
    for (let i = 0; i < 10; i++) {
      const url = new URL("https://photospicker.googleapis.com/v1/mediaItems");
      url.search = new URLSearchParams({
        sessionId,
        pageSize: "100",
        ...(pageToken ? { pageToken } : {}),
      }).toString();
      const result = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      });
      if (!result.ok) return fail(403, "A seleção não está disponível.");
      const page = await result.json();
      selected = page.mediaItems?.find((x) => x.id === mediaId);
      pageToken = page.nextPageToken;
      if (selected || !pageToken) break;
    }
    // The client cannot submit an arbitrary URL. Resolve it from Google's authorized selection.
    if (
      !selected ||
      selected.type !== "PHOTO" ||
      !validPhotoHost(selected.mediaFile?.baseUrl)
    )
      return fail(403, "Foto não encontrada na seleção.");
    const image = await fetch(selected.mediaFile.baseUrl + "=w1600-h1600", {
      headers,
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    const mime = image.headers.get("content-type")?.split(";")[0];
    if (!image.ok || !["image/jpeg", "image/png", "image/webp"].includes(mime))
      return fail(415, "Formato de foto não suportado.");
    const bytes = await readLimited(image);
    res.setHeader("Content-Type", mime);
    return res.status(200).send(bytes);
  } catch {
    return fail(502, "Não foi possível importar a foto. Tente novamente.");
  }
}
