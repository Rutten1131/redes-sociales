# Social Scheduler — Programador de publicaciones (FB / IG / YouTube)

## Qué incluye este proyecto

- Login de usuarios (tú + tus clientes) con NextAuth
- Conexión OAuth a Meta (Facebook + Instagram) y Google (YouTube)
- Tokens cifrados en base de datos (AES-256-GCM)
- Publicación en Facebook (posts, reels), Instagram (posts, reels, historias) y YouTube (videos, shorts)
- Calendario para programar publicaciones + cron que las publica automáticamente

## 1. Instalación local

```bash
cd social-scheduler
npm install
cp .env.example .env
```

Genera dos claves random y ponlas en `.env`:
```bash
openssl rand -base64 32   # para NEXTAUTH_SECRET
openssl rand -base64 32   # para TOKEN_ENCRYPTION_KEY
```

## 2. Base de datos (desarrollo local con SQLite)

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Para producción, cambia en `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"  // en vez de "sqlite"
  url      = env("DATABASE_URL")
}
```
Y usa un Postgres gratuito de Neon, Supabase o Railway como `DATABASE_URL`.

## 3. Configurar Meta for Developers

1. Ve a https://developers.facebook.com → crea una app tipo "Business"
2. Agrega los productos "Facebook Login" e "Instagram Graph API"
3. Copia el App ID y App Secret a tu `.env` (`META_APP_ID`, `META_APP_SECRET`)
4. En "Configuración > Básica", agrega tu dominio
5. En "Facebook Login > Configuración", agrega el Redirect URI:
   `https://TU-DOMINIO/api/connect/meta/callback` (y `http://localhost:3000/...` para pruebas locales)
6. En "Roles de la app", agrega a tus 2-3 clientes como Testers con su cuenta de Facebook — así pueden usar la app sin que pase por revisión de Meta
7. Cada cliente necesita: una Página de Facebook + una cuenta de Instagram Profesional (Business/Creator) vinculada a esa página

## 4. Configurar Google Cloud (YouTube)

1. Ve a https://console.cloud.google.com → crea un proyecto
2. Habilita "YouTube Data API v3" (APIs & Services > Library)
3. Configura la pantalla de consentimiento OAuth, tipo "External", estado "Testing"
4. Agrega los emails de tus clientes en "Test users"
5. Crea credenciales OAuth 2.0 (Web application), agrega el Redirect URI:
   `https://TU-DOMINIO/api/connect/youtube/callback`
6. Copia Client ID y Client Secret a tu `.env`

## 5. Storage de media (Cloudinary recomendado)

Las APIs necesitan una URL pública del video/imagen. Crea cuenta gratis en cloudinary.com,
y por ahora puedes subir el archivo manualmente y pegar la URL en el formulario del calendario.
(Se puede automatizar con un input de archivo + upload widget de Cloudinary como siguiente paso.)

## 6. Correr en local

```bash
npm run dev
```
Abre http://localhost:3000

## 7. Deploy a Vercel

```bash
npm i -g vercel
vercel
```
Configura las mismas variables de entorno del `.env` en el dashboard de Vercel
(Settings > Environment Variables). El archivo `vercel.json` ya configura el cron
que revisa cada 5 minutos qué publicar.

**Importante:** agrega también `CRON_SECRET` en Vercel — Vercel lo usa automáticamente
para autenticar sus propias llamadas al cron si tienes "Protect Cron Jobs" habilitado.

**Límite de Vercel Hobby (gratis):** funciones serverless cortan a los 10s. Subir un
video a YouTube puede tardar más. Si te pasa, sube a Vercel Pro (60s+) o mueve el
endpoint `/api/cron/publish` a un servidor propio (VPS) sin límite de tiempo.

## Estructura del proyecto

```
app/
  login/                       → login y registro
  dashboard/
    connect/                   → conectar/ver cuentas de FB, IG, YouTube
    calendar/                  → programar y ver publicaciones
  api/
    auth/[...nextauth]/        → login de la app
    auth/register/             → registro de usuarios
    connect/meta/               → inicia OAuth de Facebook/Instagram
    connect/meta/callback/      → recibe el token, descubre páginas + IG
    connect/youtube/             → inicia OAuth de Google
    connect/youtube/callback/    → recibe el token, descubre canal
    accounts/                    → lista/borra cuentas conectadas
    posts/schedule/               → crea/lista publicaciones programadas
    cron/publish/                  → publica automáticamente lo que ya tocó
lib/
  crypto.ts                    → cifrado de tokens
  prisma.ts                    → cliente de base de datos
  integrations/
    meta.ts                    → wrapper de Graph API (FB + IG)
    youtube.ts                  → wrapper de YouTube Data API
prisma/
  schema.prisma                 → User, SocialAccount, ScheduledPost
```

## Próximos pasos sugeridos

- Subida de archivos directa (drag & drop) en vez de pegar URL, integrando el
  widget de Cloudinary
- Vista de calendario tipo mensual (no solo lista cronológica)
- Reintentar manualmente un post que falló
- Notificaciones (email/Slack) cuando algo falla al publicar
