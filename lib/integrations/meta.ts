/**
 * Wrapper del Graph API de Meta para:
 * 1. Intercambiar el "code" de OAuth por un access token
 * 2. Convertir el token a uno de larga duración (60 días)
 * 3. Obtener las Páginas de Facebook del usuario y su cuenta de Instagram vinculada
 * 4. Publicar posts/reels en Facebook e Instagram
 *
 * Docs: https://developers.facebook.com/docs/graph-api
 */

const GRAPH_VERSION = "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

// ---------- OAuth ----------

export function getMetaAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    state,
    scope: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "pages_messaging",
      "pages_manage_engagement",
      "instagram_basic",
      "instagram_content_publish",
      "instagram_manage_messages",
      "instagram_manage_comments",
      "business_management",
    ].join(","),
    response_type: "code",
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    code,
  });

  const res = await fetch(`${GRAPH_URL}/oauth/access_token?${params.toString()}`);
  if (!res.ok) throw new Error(`Meta OAuth exchange failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string; // short-lived token
}

// Convierte un short-lived token en uno de larga duración (~60 días)
export async function getLongLivedToken(shortLivedToken: string) {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortLivedToken,
  });

  const res = await fetch(`${GRAPH_URL}/oauth/access_token?${params.toString()}`);
  if (!res.ok) throw new Error(`Meta long-lived token exchange failed: ${await res.text()}`);
  const data = await res.json();
  return {
    accessToken: data.access_token as string,
    expiresInSeconds: data.expires_in as number, // normalmente ~5184000 (60 días)
  };
}

// ---------- Descubrir páginas + cuenta de Instagram vinculada ----------

export interface DiscoveredPage {
  pageId: string;
  pageName: string;
  pageAccessToken: string; // token específico de la página, NO expira si el user token es long-lived
  instagramBusinessAccountId?: string;
  instagramUsername?: string;
}

export async function discoverPages(userAccessToken: string): Promise<DiscoveredPage[]> {
  const params = new URLSearchParams({
    access_token: userAccessToken,
    fields: "id,name,access_token,instagram_business_account{id,username}",
  });

  const res = await fetch(`${GRAPH_URL}/me/accounts?${params.toString()}`);
  if (!res.ok) throw new Error(`No se pudieron obtener las páginas: ${await res.text()}`);
  const data = await res.json();

  return (data.data ?? []).map((page: {
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: { id: string; username: string };
  }) => ({
    pageId: page.id,
    pageName: page.name,
    pageAccessToken: page.access_token,
    instagramBusinessAccountId: page.instagram_business_account?.id,
    instagramUsername: page.instagram_business_account?.username,
  }));
}

// ---------- Publicar en Facebook ----------

export async function publishFacebookPost(params: {
  pageId: string;
  pageAccessToken: string;
  message?: string;
  imageUrl?: string;
  videoUrl?: string; // para Reels de Facebook
  isReel?: boolean;
}) {
  const { pageId, pageAccessToken, message, imageUrl, videoUrl, isReel } = params;

  if (videoUrl) {
    // Video normal o Reel: Meta usa el mismo endpoint /videos,
    // marcando el reel con el flag correspondiente cuando aplica.
    const body = new URLSearchParams({
      access_token: pageAccessToken,
      file_url: videoUrl,
      description: message ?? "",
      published: "true", // Asegurar que aparezca en el feed
      ...(isReel ? { video_type: "reels" } : {}),
    });
    const res = await fetch(`${GRAPH_URL}/${pageId}/videos`, {
      method: "POST",
      body,
    });
    if (!res.ok) throw new Error(`Error publicando video en Facebook: ${await res.text()}`);
    return res.json();
  }

  if (imageUrl) {
    const body = new URLSearchParams({
      access_token: pageAccessToken,
      url: imageUrl,
      caption: message ?? "",
    });
    const res = await fetch(`${GRAPH_URL}/${pageId}/photos`, {
      method: "POST",
      body,
    });
    if (!res.ok) throw new Error(`Error publicando foto en Facebook: ${await res.text()}`);
    return res.json();
  }

  // Solo texto
  const body = new URLSearchParams({ access_token: pageAccessToken, message: message ?? "" });
  const res = await fetch(`${GRAPH_URL}/${pageId}/feed`, { method: "POST", body });
  if (!res.ok) throw new Error(`Error publicando texto en Facebook: ${await res.text()}`);
  return res.json();
}

// ---------- Publicar en Instagram (posts, reels, stories) ----------
// El flujo de IG siempre es en 2 pasos: 1) crear "media container", 2) publicarlo.

async function createIgContainer(params: {
  igUserId: string;
  accessToken: string;
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  mediaType: "IMAGE" | "REELS" | "STORIES";
}) {
  const { igUserId, accessToken, imageUrl, videoUrl, caption, mediaType } = params;

  const body = new URLSearchParams({
    access_token: accessToken,
    ...(caption ? { caption } : {}),
  });

  if (mediaType === "REELS") {
    body.set("media_type", "REELS");
    body.set("video_url", videoUrl!);
  } else if (mediaType === "STORIES") {
    body.set("media_type", "STORIES");
    if (videoUrl) body.set("video_url", videoUrl);
    else body.set("image_url", imageUrl!);
  } else {
    body.set("image_url", imageUrl!);
  }

  const res = await fetch(`${GRAPH_URL}/${igUserId}/media`, { method: "POST", body });
  if (!res.ok) throw new Error(`Error creando contenedor de IG: ${await res.text()}`);
  const data = await res.json();
  return data.id as string; // creation_id
}

async function waitUntilContainerReady(containerId: string, accessToken: string) {
  // Los videos/reels tardan en procesarse; hacemos polling al status_code.
  for (let i = 0; i < 30; i++) {
    const res = await fetch(
      `${GRAPH_URL}/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const data = await res.json();
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") throw new Error("El procesamiento del media de IG falló.");
    await new Promise((r) => setTimeout(r, 3000)); // espera 3s entre checks
  }
  throw new Error("Timeout esperando que Instagram procese el media.");
}

export async function publishInstagramMedia(params: {
  igUserId: string;
  accessToken: string;
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  mediaType: "IMAGE" | "REELS" | "STORIES";
}) {
  const containerId = await createIgContainer(params);

  // Siempre esperar a que el contenedor esté listo antes de publicar.
  // Aunque las imágenes son más rápidas que los videos, Instagram también
  // las procesa de forma asíncrona. Publicar sin esperar provoca el error
  // "Media ID is not available" (code 9007, subcode 2207027), especialmente
  // cuando se publica en Facebook e Instagram al mismo tiempo.
  await waitUntilContainerReady(containerId, params.accessToken);

  const body = new URLSearchParams({
    access_token: params.accessToken,
    creation_id: containerId,
  });
  const res = await fetch(`${GRAPH_URL}/${params.igUserId}/media_publish`, {
    method: "POST",
    body,
  });
  if (!res.ok) throw new Error(`Error publicando en Instagram: ${await res.text()}`);
  return res.json();
}

// ---------- Carrusel de Facebook ----------

export async function publishFacebookCarousel(params: {
  pageId: string;
  pageAccessToken: string;
  message?: string;
  items: { url: string; type: "IMAGE" | "VIDEO" }[];
}) {
  const { pageId, pageAccessToken, message, items } = params;

  // Paso 1: subir cada media sin publicar
  const mediaIds: string[] = [];
  for (const item of items) {
    const endpoint = item.type === "VIDEO" ? "videos" : "photos";
    const body = new URLSearchParams({
      access_token: pageAccessToken,
      published: "false",
      ...(item.type === "VIDEO" ? { file_url: item.url } : { url: item.url }),
    });
    const res = await fetch(`${GRAPH_URL}/${pageId}/${endpoint}`, { method: "POST", body });
    if (!res.ok) throw new Error(`Error subiendo media del carrusel FB: ${await res.text()}`);
    const data = await res.json();
    mediaIds.push(data.id);
  }

  // Paso 2: crear el post en /feed con todas las medias adjuntas
  const feedBody = new URLSearchParams({
    access_token: pageAccessToken,
    message: message ?? "",
  });
  mediaIds.forEach((id, index) => {
    feedBody.set(`attached_media[${index}]`, JSON.stringify({ media_fbid: id }));
  });

  const feedRes = await fetch(`${GRAPH_URL}/${pageId}/feed`, { method: "POST", body: feedBody });
  if (!feedRes.ok) throw new Error(`Error publicando carrusel en Facebook: ${await feedRes.text()}`);
  return feedRes.json();
}

// ---------- Carrusel de Instagram ----------

export async function publishInstagramCarousel(params: {
  igUserId: string;
  accessToken: string;
  caption?: string;
  items: { url: string; type: "IMAGE" | "VIDEO" }[];
}) {
  const { igUserId, accessToken, caption, items } = params;

  if (items.length < 2 || items.length > 10) {
    throw new Error("Un carrusel de Instagram debe tener entre 2 y 10 elementos.");
  }

  // Paso 1: crear cada child container
  const childIds: string[] = [];
  for (const item of items) {
    const body = new URLSearchParams({
      access_token: accessToken,
      is_carousel_item: "true",
      ...(item.type === "VIDEO"
        ? { media_type: "VIDEO", video_url: item.url }
        : { image_url: item.url }),
    });
    const res = await fetch(`${GRAPH_URL}/${igUserId}/media`, { method: "POST", body });
    if (!res.ok) throw new Error(`Error creando item del carrusel IG: ${await res.text()}`);
    const data = await res.json();
    childIds.push(data.id);
  }

  // Esperar procesamiento de videos
  for (let i = 0; i < items.length; i++) {
    if (items[i].type === "VIDEO") {
      await waitUntilContainerReady(childIds[i], accessToken);
    }
  }

  // Paso 2: crear el contenedor padre tipo CAROUSEL
  const parentBody = new URLSearchParams({
    access_token: accessToken,
    media_type: "CAROUSEL",
    children: childIds.join(","),
    ...(caption ? { caption } : {}),
  });
  const parentRes = await fetch(`${GRAPH_URL}/${igUserId}/media`, { method: "POST", body: parentBody });
  if (!parentRes.ok) throw new Error(`Error creando carrusel de IG: ${await parentRes.text()}`);
  const parentData = await parentRes.json();

  // Paso 3: publicar el carrusel
  const publishBody = new URLSearchParams({
    access_token: accessToken,
    creation_id: parentData.id,
  });
  const publishRes = await fetch(`${GRAPH_URL}/${igUserId}/media_publish`, { method: "POST", body: publishBody });
  if (!publishRes.ok) throw new Error(`Error publicando carrusel en Instagram: ${await publishRes.text()}`);
  return publishRes.json();
}

// ---------- Webhooks: suscribir página a eventos ----------

export async function subscribePageToWebhook(pageId: string, pageAccessToken: string) {
  const body = new URLSearchParams({
    access_token: pageAccessToken,
    subscribed_fields: "feed,messages,messaging_postbacks",
  });
  const res = await fetch(`${GRAPH_URL}/${pageId}/subscribed_apps`, {
    method: "POST",
    body,
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`Error suscribiendo página ${pageId} a webhooks:`, errText);
    throw new Error(`Error suscribiendo página al webhook: ${errText}`);
  }
  return res.json();
}

// ---------- Responder DMs y Comentarios ----------

export async function replyFacebookMessage(params: {
  pageAccessToken: string;
  recipientId: string;
  message: string;
}) {
  const body = JSON.stringify({
    recipient: { id: params.recipientId },
    message: { text: params.message },
  });
  const res = await fetch(`${GRAPH_URL}/me/messages?access_token=${params.pageAccessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) throw new Error(`Error respondiendo DM de Facebook: ${await res.text()}`);
  return res.json();
}

export async function replyInstagramMessage(params: {
  pageAccessToken: string;
  recipientId: string;
  message: string;
}) {
  // Instagram DMs también se envían vía /me/messages con el Page Access Token
  const body = JSON.stringify({
    recipient: { id: params.recipientId },
    message: { text: params.message },
  });
  const res = await fetch(`${GRAPH_URL}/me/messages?access_token=${params.pageAccessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) throw new Error(`Error respondiendo DM de Instagram: ${await res.text()}`);
  return res.json();
}

export async function replyToComment(params: {
  commentId: string;
  accessToken: string;
  message: string;
}) {
  const body = new URLSearchParams({
    access_token: params.accessToken,
    message: params.message,
  });
  const res = await fetch(`${GRAPH_URL}/${params.commentId}/comments`, {
    method: "POST",
    body,
  });
  if (!res.ok) throw new Error(`Error respondiendo comentario: ${await res.text()}`);
  return res.json();
}
