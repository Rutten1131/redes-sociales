import { NextRequest, NextResponse } from "next/server";
import { sendToMakeWebhook } from "@/lib/integrations/make";

/**
 * Endpoint de prueba para validar la conexión con Make.com
 * POST /api/test-make
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      text = "Publicación de prueba automatizada con Make.com 🚀",
      platform = "facebook",
      media_url = "https://picsum.photos/800/800",
    } = body;

    const isVideo = (media_url || "").toLowerCase().endsWith(".mp4");
    const isImage = !isVideo && Boolean(media_url);

    const payload = {
      post_id: `test_${Date.now()}`,
      text,
      platforms: Array.isArray(platform) ? platform : [platform.toLowerCase()],
      media_url: media_url || null,
      media_urls: media_url
        ? [
            {
              media_type: isVideo ? ("VIDEO" as const) : ("IMAGE" as const),
              url: media_url,
              image_url: isImage ? media_url : null,
              video_url: isVideo ? media_url : null,
            },
          ]
        : [],
      photo_urls: isImage ? [media_url] : [],
      video_urls: isVideo ? [media_url] : [],
      video_url: isVideo ? media_url : null,
      facebook_photos: isImage
        ? [
            {
              url: media_url,
              source: media_url,
              type: "Photo",
              media_type: "Photo",
            },
          ]
        : [],
      linkedin_photos: isImage
        ? [
            {
              media_type: "Photo",
              url: media_url,
            },
          ]
        : [],
      post_media_category: isVideo ? ("video" as const) : ("image" as const),
      link_para_post: null,
    };

    const result = await sendToMakeWebhook(payload);

    return NextResponse.json({
      sent_payload: payload,
      make_response: result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
