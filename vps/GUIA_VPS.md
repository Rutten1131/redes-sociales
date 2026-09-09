# 🖥️ Guía de Administración - VPS Contabo (Aquatech)

Este documento contiene toda la información necesaria para gestionar tu servidor y la aplicación.

---

## 🔐 Datos de Acceso
*   **IP del Servidor:** `178.238.238.158`
*   **Usuario:** `root`
*   **Contraseña SSH:** `Olakasetk1` (O la que definiste en el panel de Contabo)
*   **Puerto SSH:** `22` (Por defecto)

---

## 🛠️ Cómo ingreso YO (Antigravity)
Utilizo una **Llave SSH ed25519** guardada en esta misma carpeta.

*   **Llave privada (solo para Antigravity):** `D:\Abel paginas\VPS CONTABO\antigravity_vps_key`
*   **Llave pública (la que va en el VPS):** `D:\Abel paginas\VPS CONTABO\antigravity_vps_key.pub`
*   **Comando SSH que uso:** `ssh -i "D:\Abel paginas\VPS CONTABO\antigravity_vps_key" root@178.238.238.158`

### ⚙️ Instalar la llave en el VPS (hazlo UNA SOLA VEZ)
Entra al VPS con la contraseña normal y ejecuta este comando:
```bash
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMQnQ4JMR5Xh9YrmFve/HcODxYbRAIyz6JeuggeP+X0f antigravity-vps-aquatech" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo "✅ Llave instalada correctamente"
```

---

## 🚀 Comandos de Control (Docker)
Para gestionar tu CRM, entra al servidor y usa estos comandos:

| Acción | Comando |
| :--- | :--- |
| **Ver estado (CPU/RAM)** | `docker stats` |
| **Ver logs en vivo** | `docker logs -f aquatech-crm` |
| **Reiniciar la App** | `docker restart aquatech-crm` |
| **Actualizar (Tras un push)** | `cd /root/aquatech-render && git pull && docker compose up -d --build` |

---

## 📈 Monitoreo y Salud
*   **Monitor de Sistema:** Ejecuta `htop` para ver el uso de los 4 núcleos de CPU y los 8GB de RAM.
*   **Disco Duro:** Ejecuta `df -h` para ver cuánto espacio queda de los 150GB.

---

## 🌐 Configuración de Dominio (Cloudflare)
1.  **Registro A:** Apunta `@` y `www` a la IP `178.238.238.158`.
2.  **SSL/TLS:** Configura en modo **Flexible**.
3.  **Proxy:** Asegúrate de que la nube naranja esté **activada**.

---

> [!IMPORTANT]
> **Seguridad:** Nunca compartas este archivo ni lo subas a GitHub. Contiene las llaves maestras de tu infraestructura.
