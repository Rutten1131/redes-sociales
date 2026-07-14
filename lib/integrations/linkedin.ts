/**
 * Wrapper de LinkedIn API (OAuth + publicación).
 * Docs: https://learn.microsoft.com/en-us/linkedin/
 */

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const API_URL = "https://api.linkedin.com/v2";
const REST_URL = "https://api.linkedin.com/rest";
const LINKEDIN_VERSION = "202606"; // formato YYYYMM, ajustar periódicamente

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
  videoUrl?: string;
}) {
  const { accessToken, authorUrn, text, imageUrl, videoUrl } = params;

  let content: Record<string, unknown> | undefined;

  if (videoUrl) {
    // Registrar la subida de video
    const registerRes = await fetch(`${REST_URL}/videos?action=initializeUpload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": LINKEDIN_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
    });
    if (!registerRes.ok) throw new Error(`Error registrando video LinkedIn: ${await registerRes.text()}`);
    const registerData = await registerRes.json();
    const uploadInstructions = registerData.value.uploadInstructions;
    if (!uploadInstructions || uploadInstructions.length === 0) {
      throw new Error("No se recibieron instrucciones de subida de video de LinkedIn.");
    }
    const uploadUrl = uploadInstructions[0].uploadUrl as string;
    const videoUrn = registerData.value.video as string;

    // Descargar el video y subirlo
    const videoRes = await fetch(videoUrl);
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    const uploadRes = await fetch(uploadUrl, { method: "PUT", body: videoBuffer });
    if (!uploadRes.ok) throw new Error("Error subiendo el video a LinkedIn.");

    content = { media: { title: "", id: videoUrn } };
  } else if (imageUrl) {
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

export async function publishLinkedInVideo(params: {
  accessToken: string;
  authorUrn: string;
  text: string;
  videoUrl: string;
}) {
  const { accessToken, authorUrn, text, videoUrl } = params;

  // Paso 1: descargar el video para conocer su tamaño exacto en bytes
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error("No se pudo descargar el video desde mediaUrl.");
  const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

  // Paso 2: registrar la subida, indicando el tamaño (obligatorio para video)
  const registerRes = await fetch(`${REST_URL}/videos?action=initializeUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: authorUrn,
        fileSizeBytes: videoBuffer.length,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });
  if (!registerRes.ok) throw new Error(`Error registrando video LinkedIn: ${await registerRes.text()}`);
  const registerData = await registerRes.json();
  const videoUrn = registerData.value.video as string;
  const uploadInstructions = registerData.value.uploadInstructions as { uploadUrl: string }[];

  // Paso 3: subir el video
  const uploadedPartIds: string[] = [];
  for (const instruction of uploadInstructions) {
    const uploadRes = await fetch(instruction.uploadUrl, { method: "PUT", body: videoBuffer });
    if (!uploadRes.ok) throw new Error("Error subiendo el video a LinkedIn.");
    const etag = uploadRes.headers.get("etag");
    if (etag) uploadedPartIds.push(etag);
  }

  // Paso 4: finalizar la subida
  const finalizeRes = await fetch(`${REST_URL}/videos?action=finalizeUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      finalizeUploadRequest: { video: videoUrn, uploadToken: "", uploadedPartIds },
    }),
  });
  if (!finalizeRes.ok) throw new Error(`Error finalizando video LinkedIn: ${await finalizeRes.text()}`);

  // Paso 5: crear el post con el video adjunto
  const postBody = {
    author: authorUrn,
    commentary: text,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    content: { media: { title: "", id: videoUrn } },
  };
  const postRes = await fetch(`${REST_URL}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(postBody),
  });
  if (!postRes.ok) throw new Error(`Error publicando video en LinkedIn: ${await postRes.text()}`);
  return { id: postRes.headers.get("x-restli-id") ?? "unknown" };
}

