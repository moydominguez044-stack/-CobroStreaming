# 📺 Cobros Streaming

App instalable (PWA) para llevar el control de cobros de cuentas de streaming (Netflix, Disney+, Max, Spotify…), con recordatorios por **WhatsApp** y cálculo automático de **meses acumulados**.

> Creada y de autoría del Ing. Moisés Mendoza.

**App:** https://moydominguez044-stack.github.io/-CobroStreaming/

## Cómo está armada

- **La app** (`index.html`, `manifest.webmanifest`, `sw.js`, `icons/`) vive en **GitHub Pages**. Se instala en el celular como cualquier app, abre a pantalla completa y muestra los últimos datos aunque no haya señal.
- **El servidor de datos** (`apps-script/Code.gs`) es un Google Apps Script que guarda todo en una hoja de Google en tu Drive. La app se conecta a él con la URL `/exec` y una **clave**.

## Qué hace

- **Cobros del día:** muestra quién está vencido, a quién le vence hoy y a quién le vence pronto, con el total a cobrar.
- **Meses acumulados:** si un cliente debe varios meses, la app los cuenta y los pone en el mensaje, por ejemplo *"Netflix (Perfil 2): 2 meses (sep, oct) — C$ 300"*.
- **WhatsApp semiautomático:** el botón verde abre WhatsApp con el mensaje ya escrito. Queda marcado como "Avisado hoy".
- **Resumen diario por correo:** cada mañana llega a tu Gmail la lista de cobros del día con un botón de WhatsApp por cliente.
- **Precios:** el precio se define por servicio y se puede poner un precio especial por cuenta.
- **Pagos:** se registra cuántos meses pagó y la próxima fecha de pago se adelanta sola. Los pagos se pueden anular.
- **Mensaje editable** con variables `{nombre}`, `{detalle}`, `{total}`, `{meses}`, `{negocio}`.

## 1. Servidor (Apps Script)

1. En [script.google.com](https://script.google.com), abre o crea el proyecto *Cobros Streaming*.
2. Pega `apps-script/Code.gs` en `Código.gs`. Si existe un archivo HTML `Index` de una versión anterior, **bórralo**.
3. En **Configuración del proyecto** ⚙️, activa *"Mostrar el archivo de manifiesto"* y pega `apps-script/appsscript.json`.
4. Ve a **Implementar → Administrar implementaciones → ✏️ editar**:
   - *Versión:* **Nueva versión**
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquier usuario**

   Así se conserva la misma URL `/exec`. Si es la primera vez, usa *Nueva implementación → Aplicación web* con esas mismas opciones.
5. Autoriza los permisos que pide Google.

## 2. Instalar en el celular

1. Abre https://moydominguez044-stack.github.io/-CobroStreaming/ en **Chrome** (Android) o **Safari** (iPhone).
2. La primera vez pide la **URL del servidor**, que ya viene puesta, y una **clave**. La clave que escribas la primera vez queda como la clave de tu servidor; guárdala.
3. Instálala:
   - **Android (Chrome):** menú ⋮ → **Instalar app** o **Agregar a pantalla principal**.
   - **iPhone (Safari):** botón Compartir → **Agregar a inicio**.

¿Olvidaste la clave? En el editor de Apps Script ejecuta la función `reiniciarClave`. La siguiente clave que uses en la app será la nueva.

## Compartir con amigos

- **Para que usen tus datos** (por ejemplo, alguien que te ayuda a cobrar): dales el enlace de la app y tu clave.
- **Para que tengan sus propios datos:** cada uno hace su copia del script, la implementa (paso 1) y en la app toca **Ajustes → Servidor → Cambiar** para pegar su propia URL `/exec` y crear su clave.

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | La app: Cobros, Clientes, Servicios, Pagos, Ajustes |
| `manifest.webmanifest`, `sw.js`, `icons/` | Lo que la hace instalable y le permite abrir sin señal |
| `apps-script/Code.gs` | Servidor: API con clave, datos en Google Sheets, meses acumulados, mensajes, resumen diario |
| `apps-script/appsscript.json` | Zona horaria (America/Managua) y configuración de la aplicación web |
