import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import crypto from "crypto";

/**
 * POST /api/upload/sign
 * Returns a signed upload URL + credentials so the client can upload directly
 * to BunnyCDN Storage without going through Vercel's 4.5MB body limit.
 *
 * Body: { fileName: string }
 * Returns: { uploadUrl, publicUrl, apiKey, fileName }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const apiKey = process.env.BUNNY_STORAGE_API_KEY;
  const storageZone = process.env.BUNNY_STORAGE_ZONE;
  const cdnHostname = process.env.BUNNY_CDN_HOSTNAME;

  if (!apiKey || !storageZone || !cdnHostname) {
    return NextResponse.json(
      { error: "BunnyCDN no configurado en el servidor" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const originalName = body.fileName || "file.bin";
  const ext = originalName.split(".").pop() ?? "bin";
  const uniqueName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const storagePath = `uploads/${uniqueName}`;

  // Return the upload credentials so the client can PUT directly to BunnyCDN
  return NextResponse.json({
    uploadUrl: `https://storage.bunnycdn.com/${storageZone}/${storagePath}`,
    publicUrl: `https://${cdnHostname}/${storagePath}`,
    apiKey, // Client needs this to authenticate the PUT request
    fileName: uniqueName,
  });
}
