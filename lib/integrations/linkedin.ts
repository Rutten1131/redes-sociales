/**
 * Wrapper de LinkedIn API (OAuth + publicación).
 * Docs: https://learn.microsoft.com/en-us/linkedin/
 */

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const API_URL = "https://api.linkedin.com/v2";
const REST_URL = "https://api.linkedin.com/rest";
const LINKEDIN_VERSION = "202501"; // formato YYYYMM

export function getLinkedInAuthUrl(state: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    state,
    scope: "openid profile email w_member_social",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeLinkedInCode(code: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`Error de OAuth de LinkedIn: ${await res.text()}`);
  const data = await res.json();
  return {
    accessToken: data.access_token as string,
    expiresInSeconds: data.expires_in as number, // normalmente 60 días
  };
}

export async function getLinkedInProfile(accessToken: string) {
  const res = await fetch(`${API_URL}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Error obteniendo perfil de LinkedIn: ${await res.text()}`);
  const data = await res.json();
  return {
    id: data.sub as string,       // el URN/ID del usuario
    name: data.name as string,
    avatarUrl: data.picture as string | undefined,
  };
}

// ---------- Publicar (texto + imagen simple) ----------

export async function publishLinkedInPost(params: {
  accessToken: string;
  authorUrn: string; // "urn:li:person:XXXX"
  text: string;
  imageUrl?: string;
}) {
  const { accessToken, authorUrn, text, imageUrl } = params;

  let content: Record<string, unknown> | undefined;

  if (imageUrl) {
    // Registrar la subida de imagen
    const registerRes = await fetch(`${REST_URL}/images?action=initializeUpload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": LINKEDIN_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
    });
    if (!registerRes.ok) throw new Error(`Error registrando imagen LinkedIn: ${await registerRes.text()}`);
    const registerData = await registerRes.json();
    const uploadUrl = registerData.value.uploadUrl as string;
    const imageUrn = registerData.value.image as string;

    // Descargar la imagen y subirla al uploadUrl que dio LinkedIn
    const imageRes = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
    const uploadRes = await fetch(uploadUrl, { method: "PUT", body: imageBuffer });
    if (!uploadRes.ok) throw new Error("Error subiendo la imagen a LinkedIn.");

    content = { media: { title: "", id: imageUrn } };
  }

  const body: Record<string, unknown> = {
    author: authorUrn,
    commentary: text,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    ...(content ? { content } : {}),
  };

  const res = await fetch(`${REST_URL}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Error publicando en LinkedIn: ${await res.text()}`);
  return { id: res.headers.get("x-restli-id") ?? "unknown" };
}
