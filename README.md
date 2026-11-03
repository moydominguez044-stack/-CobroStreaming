# 📺 Cobros Streaming

App web en **Google Apps Script** para llevar el control de cobros de cuentas de streaming (Netflix, Disney+, Max, Spotify…), con recordatorios por **WhatsApp** y cálculo automático de **meses acumulados**.

> Creada y de autoría del Ing. Moisés Mendoza.

## Qué hace

- **Cobros del día:** muestra quién está vencido, a quién le vence hoy y a quién le vence pronto, con el total a cobrar.
- **Meses acumulados:** si un cliente debe varios meses, la app los cuenta y los pone en el mensaje, por ejemplo *"Netflix (Perfil 2): 2 meses (sep, oct) — C$ 300"*.
- **WhatsApp semiautomático:** el botón verde abre WhatsApp con el mensaje ya escrito para ese cliente. Solo hay que tocar *Enviar*. Queda marcado como "Avisado hoy".
- **Resumen diario por correo:** cada mañana llega a tu Gmail la lista de cobros del día con un botón de WhatsApp por cliente. Desde el celular es un toque por cliente.
- **Precios:** el precio se define por servicio. Si cambia, se actualiza en todas las cuentas. También se puede poner un precio especial por cuenta.
- **Pagos:** se registra cuántos meses pagó y la próxima fecha de pago se adelanta sola. Los pagos se pueden anular.
- **Mensaje editable** con variables `{nombre}`, `{detalle}`, `{total}`, `{meses}`, `{negocio}`.
- **Para compartir:** cada persona que abre la app tiene sus propios datos en una hoja de Google de su propio Drive. Nadie ve los clientes de otro.

## Instalación

1. Entra a [script.google.com](https://script.google.com) y crea un **Proyecto nuevo**. Ponle de nombre *Cobros Streaming*.
2. Pega el contenido de `Code.gs` en el archivo `Código.gs`.
3. Crea un archivo **HTML** llamado exactamente `Index` y pega `Index.html`.
4. En **Configuración del proyecto** ⚙️, activa *"Mostrar el archivo de manifiesto appsscript.json"* y reemplaza su contenido con `appsscript.json`.
5. Ve a **Implementar → Nueva implementación → Aplicación web**:
   - *Ejecutar como:* **Usuario que accede a la aplicación web**
   - *Quién tiene acceso:* **Cualquier usuario con cuenta de Google**
6. Copia la URL y ábrela en el celular. Puedes agregarla a la pantalla de inicio.

La primera vez Google pide permisos. Son para crear tu hoja de datos, mandarte el resumen por correo y programar el resumen diario.

### Compartir con amigos

Mándales la misma URL. Cada uno entra con su cuenta de Google y la app le crea su propia hoja de datos.

## Uso rápido

1. **Servicios:** pon el precio mensual de cada servicio.
2. **Clientes → +:** agrega el cliente con su WhatsApp. El número de 8 dígitos lleva +505 automáticamente.
3. **Agregar cuenta:** elige el servicio, el perfil y la fecha de pago. Si pones una fecha pasada, la app calcula los meses que debe.
4. **Cobros:** toca *Recordar por WhatsApp*. Cuando te pague, toca *Pago*.
5. **Ajustes:** activa el *Resumen diario por correo* y elige la hora.

## Estructura

| Archivo | Contenido |
|---|---|
| `Code.gs` | Datos en Google Sheets, cálculo de vencimientos y meses acumulados, mensajes, resumen diario |
| `Index.html` | Interfaz móvil: Cobros, Clientes, Servicios, Pagos, Ajustes |
| `appsscript.json` | Zona horaria (America/Managua) y configuración de la aplicación web |
