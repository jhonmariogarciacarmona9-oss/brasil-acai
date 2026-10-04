# Manual super simple (paso a paso)

## Objetivo
Cuando toques "Enviar a proveedores", el sistema envia solo los correos con PDF (sin abrir Gmail).

## Lo que vas a usar
- Tu proyecto en Supabase
- Una cuenta de Resend (servicio de correos)
- Un dominio para enviar como empresa (recomendado)

## Paso 1: Crear la tabla y columnas
1. Abre Supabase.
2. Ve a SQL Editor.
3. Copia y ejecuta el archivo: `supabase/sql/2026-01-01_envios_y_proveedores.sql`.
4. Si sale "Success", listo.

## Paso 2: Crear funcion Edge
1. Instala Supabase CLI en tu PC (si no lo tienes).
2. En terminal, dentro del proyecto, ejecuta:

```bash
supabase functions deploy send-provider-orders
```

3. Verifica que subio sin errores.

### Comandos exactos para Windows (copiar y pegar)
Abre PowerShell en la carpeta del proyecto y ejecuta, uno por uno:

	choco install supabase
	supabase --version
	supabase login
	supabase link --project-ref TU_PROJECT_REF
	supabase functions deploy send-provider-orders --project-ref TU_PROJECT_REF

Si no tienes Chocolatey, instala con Winget:

	winget install Supabase.CLI

Como sacar TU_PROJECT_REF:
1. Supabase Dashboard.
2. Settings.
3. General.
4. Copia Project Reference ID.

## Paso 3: Configurar variables secretas
En Supabase -> Edge Functions -> Secrets, agrega:
- `RESEND_API_KEY` = tu API key de Resend
- `EMAIL_FROM` = por ejemplo `Pedidos Brasil Acai <pedidos@tudominio.com>`

Nota: `EMAIL_FROM` debe ser un dominio verificado en Resend.

### Prueba rapida sin dominio propio (solo test)
Si todavia no tienes dominio, puedes probar primero con un remitente de test:

	supabase secrets set EMAIL_FROM="Pedidos Brasil Acai <onboarding@resend.dev>" --project-ref ssdehjmlcylrrhexvcfq

Esto sirve para validar el flujo tecnico. Para produccion y envios reales a clientes, usa tu dominio verificado.

Tambien puedes hacerlo por terminal:

	supabase secrets set RESEND_API_KEY=TU_API_KEY --project-ref TU_PROJECT_REF
	supabase secrets set EMAIL_FROM="Pedidos Brasil Acai <pedidos@tudominio.com>" --project-ref TU_PROJECT_REF

## Paso 4: Verificar dominio en Resend
1. Entra a Resend.
2. Domains -> Add Domain.
3. Escribe tu dominio (ejemplo: `tudominio.com`).
4. Copia los DNS que te da Resend en tu proveedor de dominio.
5. Espera a que diga "Verified".

## Paso 5: Probar envio real
1. En tu app, selecciona productos y proveedores con correo.
2. Pulsa enviar.
3. Debe salir mensaje de exito.
4. Revisa la tabla `envios_pedidos_log` para confirmar.

## Paso 6: Si falla
- Si dice que backend no disponible, revisa que la funcion exista y que no falten secrets.
- Si dice error de Resend, revisa API key y dominio verificado.

## Error comun: "no such file or directory index.ts"
Esto pasa cuando ejecutas el deploy fuera de la carpeta del proyecto.

Haz esto:
1. Entra primero a la carpeta correcta:

	cd C:\\Users\\jhonm\\Desktop\\BrasilAcai

2. Luego vuelve a desplegar:

	supabase functions deploy send-provider-orders --project-ref ssdehjmlcylrrhexvcfq

## Costos de dominio (claro y rapido)
- Dominio propio casi siempre es de pago.
- Normalmente cuesta entre 8 y 20 USD al ano, segun extension (.com, .net, etc).
- Gratis: existen subdominios de plataformas, pero para correos profesionales no es lo ideal.

## Alternativa gratis sin comprar dominio
Si no quieres comprar dominio, usa tu Gmail actual (`pedidosbrasilacai@gmail.com`) con Gmail API.

Ventajas:
- No compras dominio.
- El correo sale desde tu Gmail real.

Limites:
- Configuracion un poco mas larga (OAuth de Google).
- Limite diario aproximado de Gmail personal (normalmente hasta 500 envios/dia).

Resumen de pasos:
1. Crear proyecto en Google Cloud.
2. Activar Gmail API.
3. Crear credenciales OAuth (Desktop App).
4. Obtener `refresh_token` de tu Gmail.
5. Guardar secretos en Supabase (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GMAIL_SENDER`).
6. Ajustar la funcion Edge para enviar por Gmail API en vez de Resend.

Si quieres, hacemos esta ruta ahora mismo y te dejo todo listo sin dominio.

## Alternativa gratis SIN tarjeta (recomendada si Google Cloud te pide tarjeta)
Usa Google Apps Script como puente de envio con tu Gmail.

Que necesitas:
1. Entrar en https://script.google.com
2. Crear proyecto nuevo.
3. Pegar un script `doPost(e)` que:
   - Valide `x-webhook-key`.
   - Lea `to`, `subject`, `html` y `attachment.base64`.
   - Envie con `MailApp.sendEmail` desde tu Gmail.
4. Deploy -> Web app -> acceso "Anyone".
5. Copiar URL del Web App.

Secrets que debes guardar en Supabase para este modo:

	supabase secrets set APPS_SCRIPT_WEBHOOK_URL=TU_WEBAPP_URL --project-ref ssdehjmlcylrrhexvcfq
	supabase secrets set APPS_SCRIPT_WEBHOOK_KEY=TU_CLAVE_SECRETA --project-ref ssdehjmlcylrrhexvcfq
	supabase secrets set APPS_SCRIPT_SENDER=pedidosbrasilacai@gmail.com --project-ref ssdehjmlcylrrhexvcfq

Nota: este modo ya esta soportado por la funcion desplegada.

## Que hice yo y que haces tu
Ya hecho por mi:
- Funcion `send-provider-orders` desplegada en Supabase.
- Backend preparado para 2 modos: Gmail API (gratis) y Resend (dominio propio).
- Frontend ya conectado para envio automatico.

Lo unico manual (tu cuenta Google):
1. Crear credenciales OAuth en Google Cloud.
2. Autorizar tu Gmail para obtener `refresh_token`.
3. Guardar esos secretos en Supabase.

Comandos que vas a ejecutar cuando tengas los valores:

	supabase secrets set GOOGLE_CLIENT_ID=TU_CLIENT_ID --project-ref ssdehjmlcylrrhexvcfq
	supabase secrets set GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET --project-ref ssdehjmlcylrrhexvcfq
	supabase secrets set GOOGLE_REFRESH_TOKEN=TU_REFRESH_TOKEN --project-ref ssdehjmlcylrrhexvcfq
	supabase secrets set GMAIL_SENDER=pedidosbrasilacai@gmail.com --project-ref ssdehjmlcylrrhexvcfq

## Opciones recomendadas
1. Profesional y estable: dominio propio + Resend.
2. Muy barato: dominio en oferta primer ano + Resend plan gratis para empezar.
