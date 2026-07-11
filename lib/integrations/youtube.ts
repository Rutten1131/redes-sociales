/**
 * Wrapper de YouTube Data API v3 para OAuth y subida de videos/shorts.
 * Docs: https://developers.google.com/youtube/v3/docs/videos/insert
 */

const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_UPLOAD_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";

// ---------- OAuth ----------

export function getYoutubeAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    access_type: "offline", // necesario para obtener refresh_token
    prompt: "consent", // fuerza a que siempre devuelva refresh_token
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ].join(" "),
    state,
  });
  return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
}

export async function exchangeYoutubeCode(code: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) throw new Error(`Error de OAuth de Google: ${await res.text()}`);
  const data = await res.json();
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string | undefined,
    expiresInSeconds: data.expires_in as number,
  };
}

export async function refreshYoutubeToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Error renovando token de Google: ${await res.text()}`);
  const data = await res.json();
  return {
    accessToken: data.access_token as string,
    expiresInSeconds: data.expires_in as number,
  };
}

export async function getYoutubeChannel(accessToken: string) {
  const res = await fetch(
    `${YOUTUBE_API_URL}/channels?part=snippet&mine=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Error obteniendo canal: ${await res.text()}`);
  const data = await res.json();
  const channel = data.items?.[0];
  return {
    channelId: channel?.id as string,
    title: channel?.snippet?.title as string,
    thumbnailUrl: channel?.snippet?.thumbnails?.default?.url as string,
  };
}

// ---------- Subir video / short ----------
// El video debe descargarse primero como buffer (desde tu storage: S3/Cloudinary)
// porque la API de YouTube requiere subida resumable, no una URL directa.

export async function uploadYoutubeVideo(params: {
  accessToken: string;
  videoBuffer: Buffer;
  title: string;
  description?: string;
  isShort?: boolean; // videos verticales <60s se detectan como Shorts automáticamente
  privacyStatus?: "public" | "unlisted" | "private";
}) {
  const { accessToken, videoBuffer, title, description, isShort, privacyStatus } = params;

  // Paso 1: iniciar sesión de subida resumable
  const initRes = await fetch(YOUTUBE_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Type": "video/*",
    },
    body: JSON.stringify({
      snippet: {
        title,
        description: isShort ? `${description ?? ""}\n\n#Shorts` : description,
      },
      status: { privacyStatus: privacyStatus ?? "public" },
    }),
  });

  if (!initRes.ok) throw new Error(`Error iniciando subida a YouTube: ${await initRes.text()}`);
  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("YouTube no devolvió una URL de subida.");

  // Paso 2: subir el archivo de video
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/*" },
    body: videoBuffer as any,
  });

  if (!uploadRes.ok) throw new Error(`Error subiendo video a YouTube: ${await uploadRes.text()}`);
  return uploadRes.json(); // incluye el video id publicado
}
