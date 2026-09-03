/**
 * Integración oficial con el Pipeline de Make.com (RRSS Automation)
 * Blueprint: Automatización de RRSS Objetivo
 */

export interface MakePostPayload {
  version?: string;
  post_id: string;
  text: string;
  media_url?: string | null;
  media_urls?: Array<{
    media_type: 'IMAGE' | 'VIDEO' | 'LINK';
    url: string;
    image_url?: string | null;
    video_url?: string | null;
  }>;
  photo_urls?: string[];
  video_urls?: string[];
  video_url?: string | null;
  facebook_photos?: Array<{
    url: string;
    source: string;
    type: string;
    media_type: string;
  }>;
  linkedin_photos?: Array<{
    media_type: string;
    url: string;
  }>;
  files?: Array<{
    media_type: 'IMAGE' | 'VIDEO';
    image_url?: string;
    video_url?: string;
  }>;
  post_media_category: 'image' | 'video' | 'carousel' | 'story';
  link_para_post?: string | null;
  platforms: string[];
  metadata?: Record<string, any>;
}

/**
 * Convierte un post programado al formato exacto y estricto esperado por el Blueprint de Make.com
 */
export function formatPayloadForMake(params: {
  postId: string;
  caption?: string | null;
  platforms: string[]; // ["FACEBOOK", "INSTAGRAM", "YOUTUBE", "LINKEDIN"]
  type: string;        // FEED_POST, REEL, STORY, VIDEO, SHORT, CAROUSEL, VIDEO_NORMAL
  mediaUrl?: string | null;
  mediaItems?: Array<{ url: string; type: 'IMAGE' | 'VIDEO' }>;
}): MakePostPayload {
  const { postId, caption, platforms, type, mediaUrl, mediaItems } = params;
  const isCarousel = type === 'CAROUSEL' && Array.isArray(mediaItems) && mediaItems.length > 1;
  const isVideo = !isCarousel && (
    type === 'REEL' ||
    type === 'VIDEO' ||
    type === 'SHORT' ||
    type === 'VIDEO_NORMAL' ||
    (mediaUrl || '').toLowerCase().match(/\.(mp4|mov|avi|mkv|webm|3gp|wmv)($|\?)/) !== null
  );

  const isStory = type === 'STORY';

  let post_media_category: 'image' | 'video' | 'carousel' | 'story' = 'image';
  if (isStory) {
    post_media_category = 'story';
  } else if (isCarousel) {
    post_media_category = 'carousel';
  } else if (isVideo) {
    post_media_category = 'video';
  }

  // Mapear plataformas a minúsculas
  const mappedPlatforms = platforms.map(p => p.toLowerCase());

  // Mapear media_urls de forma consistente
  let media_urls: Array<{
    media_type: 'IMAGE' | 'VIDEO' | 'LINK';
    url: string;
    image_url?: string | null;
    video_url?: string | null;
  }> = [];

  let photo_urls: string[] = [];
  let video_urls: string[] = [];
  let facebook_photos: Array<{ url: string; source: string; type: string; caption: string; media_type: string }> = [];
  let linkedin_photos: Array<{ media_type: string; url: string }> = [];
  let files: Array<{
    media_type: 'IMAGE' | 'VIDEO';
    image_url?: string;
    video_url?: string;
  }> = [];

  if (isCarousel && mediaItems) {
    media_urls = mediaItems.map(item => item.url) as any;
    photo_urls = mediaItems.filter(i => i.type === 'IMAGE').map(i => i.url);
    video_urls = mediaItems.filter(i => i.type === 'VIDEO').map(i => i.url);

    // Formato exacto que espera CreateCarouselPhoto en Instagram (mezcla fotos+videos OK)
    files = mediaItems.map(item => ({
      media_type: item.type === 'VIDEO' ? 'VIDEO' : 'IMAGE',
      image_url: item.type !== 'VIDEO' ? item.url : undefined,
      video_url: item.type === 'VIDEO' ? item.url : undefined,
    }));

    // Facebook CreatePostWithPhotos SOLO acepta imágenes (limitación de la Graph API).
    // Solo pasamos las fotos del carrusel; los videos no pueden mezclarse en este módulo.
    facebook_photos = photo_urls.map(url => ({
      url,
      source: url,
      type: 'url',
      caption: '',
      media_type: 'Photo',
    }));

    // LinkedIn: La API de Make solo permite 1 imagen por publicación.
    // En carruseles, publicamos la primera foto como imagen destacada + texto.
    // No usamos categoría 'carousel' en LinkedIn para evitar rutas no soportadas.
    linkedin_photos = photo_urls.slice(0, 1).map(url => ({
      media_type: 'Photo',
      url,
    }));
  } else if (mediaUrl) {
    const itemType = isVideo ? 'VIDEO' : 'IMAGE';
    media_urls = [mediaUrl] as any;
    if (isVideo) {
      video_urls = [mediaUrl];
    } else {
      photo_urls = [mediaUrl];
      facebook_photos = [
        {
          url: mediaUrl,
          source: mediaUrl,
          type: 'url',
          caption: caption || '',
          media_type: 'Photo',
        },
      ];
      linkedin_photos = [
        {
          media_type: 'Photo',
          url: mediaUrl,
        },
      ];
    }
  }

  // Si es carrusel y hay fotos, aseguramos que media_url tenga la primera foto para LinkedIn
  const firstPhotoUrl = photo_urls.length > 0 ? photo_urls[0] : null;
  const finalMediaUrl = isCarousel ? (firstPhotoUrl || mediaUrl || (mediaItems && mediaItems[0]?.url) || null) : (mediaUrl || (mediaItems && mediaItems.length > 0 ? mediaItems[0].url : null));

  return {
    version: '2.0',
    post_id: postId,
    text: caption || '',
    media_url: finalMediaUrl,
    media_urls,
    photo_urls,
    video_urls,
    video_url: isVideo ? mediaUrl : null,
    files,
    facebook_photos,
    linkedin_photos,
    post_media_category,
    link_para_post: null,
    platforms: mappedPlatforms,
    metadata: {
      original_type: type,
      created_at: new Date().toISOString(),
    },
  };
}

/**
 * Envía la carga de publicación al Webhook configurado en Make.com
 */
export async function sendToMakeWebhook(payload: MakePostPayload): Promise<{ success: boolean; data?: any; error?: string }> {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("MAKE_WEBHOOK_URL no está configurada en las variables de entorno.");
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Make.com respondió con HTTP ${response.status}: ${errorText}`,
      };
    }

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    return {
      success: true,
      data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Error de red al conectar con Make.com: ${err.message}`,
    };
  }
}
