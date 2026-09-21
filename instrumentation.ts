export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkAndPublishDuePosts } = await import("@/lib/local-cron");
    console.log("⏰ [CRON AUTOMÁTICO LOCAL] Inicializado cada 30 segundos.");
    
    // Ejecutar inmediatamente al inicio
    checkAndPublishDuePosts().catch(console.error);

    // Y ejecutar periódicamente cada 30 segundos
    setInterval(() => {
      checkAndPublishDuePosts().catch(console.error);
    }, 30000);
  }
}
