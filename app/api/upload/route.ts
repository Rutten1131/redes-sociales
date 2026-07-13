import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import crypto from "crypto";

// POST /api/upload — sube un archivo a BunnyCDN Storage y devuelve la URL pública del CDN.
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

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
  }

  // Generar un nombre único para evitar colisiones
  const ext = file.name.split(".").pop() ?? "bin";
  const uniqueName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const storagePath = `uploads/${uniqueName}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  // Subir a BunnyCDN Storage API
  const uploadRes = await fetch(
    `https://storage.bunnycdn.com/${storageZone}/${storagePath}`,
    {
      method: "PUT",
      headers: {
        AccessKey: apiKey,
        "Content-Type": "application/octet-stream",
      },
      body: buffer as any,
    }
  );

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    console.error("BunnyCDN upload error:", uploadRes.status, errorText);
    return NextResponse.json(
      { error: `Error al subir archivo: ${uploadRes.status}` },
      { status: 500 }
    );
  }

  const publicUrl = `https://${cdnHostname}/${storagePath}`;

  return NextResponse.json({ url: publicUrl, fileName: uniqueName });
}
