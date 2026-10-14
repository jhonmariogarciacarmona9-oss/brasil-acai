# Configurar el envío automático de pedidos

Esta app envía los pedidos mediante la Edge Function `send-provider-orders` de Supabase. Esa función reenvía el correo a Google Apps Script. La URL y la clave del webhook deben estar guardadas como secretos de Supabase; los valores de `localStorage` del navegador no los sustituyen.

## 1. Preparar Google Apps Script

1. Abre el proyecto de Apps Script que contiene [apps-script-webhook.gs](./apps-script-webhook.gs) y pega ese código.
2. En **Configuración del proyecto → Propiedades del script**, crea `WEBHOOK_KEY` y asígnale una clave larga. Guarda esa misma clave para el paso 4.
3. Ve a **Implementar → Nueva implementación → Aplicación web**.
4. Selecciona **Ejecutar como: yo** y **Quién tiene acceso: Cualquier persona**. Implementa y copia la URL que termina en `/exec`.
5. Si vuelves a editar el código, crea una nueva versión de la implementación y conserva la URL `/exec` actualizada.

## 2. Aplicar la migración SQL en Supabase

1. Abre el proyecto Brasil Acai en Supabase. El Project Reference que usa esta app es `tjdtbjatvlfouaspslju`.
2. Entra en **SQL Editor → New query**.
3. Abre [2026-01-01_envios_y_proveedores.sql](../supabase/sql/2026-01-01_envios_y_proveedores.sql), copia todo su contenido, pégalo en el editor y pulsa **Run**.
4. En **Table Editor**, confirma que existe `envios_pedidos_log`.

La migración añade los campos de proveedores que usa el flujo y crea la tabla de registro. La prueba anterior confirmó que esa tabla aún no estaba en el esquema remoto.

## 3. Guardar los secretos de la Edge Function

En Supabase, abre **Edge Functions → Secrets** y crea estos tres secretos:

| Nombre | Valor |
| --- | --- |
| `APPS_SCRIPT_WEBHOOK_URL` | La URL `/exec` de la aplicación web de Apps Script |
| `APPS_SCRIPT_WEBHOOK_KEY` | La misma clave que guardaste como `WEBHOOK_KEY` en Apps Script |
| `APPS_SCRIPT_SENDER` | La dirección Gmail de la cuenta que implementó la aplicación web |

Pulsa **Save**. No pongas estos valores en el código del frontend ni los compartas en el chat. `APPS_SCRIPT_SENDER` no cambia la cuenta remitente de Gmail; Apps Script envía desde la cuenta que lo implementó.

## 4. Desplegar la función corregida

La carpeta local ya está corregida: ahora contiene una sola implementación de las funciones auxiliares y una sola llamada a `Deno.serve`. La CLI de este equipo no está autenticada, así que hay que iniciar sesión antes del despliegue.

Abre PowerShell en `C:\Users\jhonm\Desktop\BrasilAcai` y ejecuta:

```powershell
supabase init
supabase login
supabase link --project-ref tjdtbjatvlfouaspslju
supabase functions deploy send-provider-orders --project-ref tjdtbjatvlfouaspslju
```

En `supabase login`, crea un **Personal Access Token** desde [Supabase Account → Access Tokens](https://supabase.com/dashboard/account/tokens) y pégalo únicamente en la terminal, nunca aquí. Si `supabase init` pregunta si debe sobrescribir un `config.toml` existente, responde que no.

Cuando termine, en Supabase abre **Edge Functions → send-provider-orders** y confirma que aparece como desplegada. En los logs de la función podrás ver el detalle de nuevas invocaciones.

## 5. Probar desde la app

1. Recarga la app con `Ctrl+F5` para que cargue el JavaScript actualizado.
2. Selecciona únicamente el proveedor y los productos del pedido que quieras probar.
3. Pulsa **Enviar a proveedores** una sola vez.
4. Debe aparecer un resultado de envío. Revisa los logs de `send-provider-orders` y la tabla `envios_pedidos_log`.
5. Confirma la recepción en el Gmail remitente y en el buzón del proveedor.

Si la Edge Function sigue respondiendo `404 Requested function was not found`, revisa que el despliegue se haya hecho en el proyecto `tjdtbjatvlfouaspslju` y que el nombre sea exactamente `send-provider-orders`. Un error de configuración de secretos aparecerá como respuesta de la propia función; un rechazo o error de Apps Script también se devolverá como fallo y no se marcará como envío correcto.
