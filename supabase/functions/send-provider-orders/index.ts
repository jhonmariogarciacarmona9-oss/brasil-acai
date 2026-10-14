import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { ESLOGAN_PNG_BASE64, LOGO_PNG_BASE64 } from './branding.ts';

type OrderItem = {
  sku?: string;
  producto: string;
  cantidad_a_pedir: number;
};

type ProviderOrder = {
  proveedor: string;
  correos: string[];
  proveedor_cif?: string;
  proveedor_direccion?: string;
  proveedor_telefono?: string;
  numero_pedido?: string;
  items: OrderItem[];
  tiendas?: string[];
  direcciones?: string[];
};

type RequestBody = {
  senderEmail: string;
  replyTo?: string;
  orders: ProviderOrder[];
};

let brandingAssets: { logo: Uint8Array; eslogan: Uint8Array } | null = null;

function decodeBase64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getBrandingAssets() {
  if (!brandingAssets) {
    brandingAssets = {
      logo: decodeBase64ToBytes(LOGO_PNG_BASE64),
      eslogan: decodeBase64ToBytes(ESLOGAN_PNG_BASE64)
    };
  }

  return brandingAssets;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

function safeText(value: unknown, fallback = '-') {
  const text = String(value || '').trim();
  return text || fallback;
}

function truncate(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}...`;
}

function drawRect(page: any, x: number, y: number, width: number, height: number, fill = rgb(1, 1, 1), borderColor = rgb(0.82, 0.82, 0.84)) {
  page.drawRectangle({ x, y, width, height, color: fill, borderColor, borderWidth: 1 });
}

function toBase64Url(value: string) {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeUtf8ToBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function bytesToBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function validateBody(body: RequestBody) {
  if (!body || !Array.isArray(body.orders) || body.orders.length === 0) {
    throw new Error('Body invalido: orders es obligatorio');
  }
}

function drawWrappedText(
  page: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: any,
  size: number,
  color = rgb(0, 0, 0),
  lineHeight = 14
) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) {
    return y;
  }

  let line = '';
  let cursorY = y;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) {
      page.drawText(line, { x, y: cursorY, size, font, color });
      cursorY -= lineHeight;
    }
    line = word;
  }

  if (line) {
    page.drawText(line, { x, y: cursorY, size, font, color });
    cursorY -= lineHeight;
  }

  return cursorY;
}

async function buildPdf(order: ProviderOrder) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const branding = getBrandingAssets();

  if (branding) {
    try {
      const esloganImage = await pdfDoc.embedPng(branding.eslogan);
      const logoImage = await pdfDoc.embedPng(branding.logo);

      const esloganScale = 210 / esloganImage.width;
      const esloganWidth = esloganImage.width * esloganScale;
      const esloganHeight = esloganImage.height * esloganScale;

      const logoScale = 72 / logoImage.width;
      const logoWidth = logoImage.width * logoScale;
      const logoHeight = logoImage.height * logoScale;

      page.drawImage(esloganImage, {
        x: 36,
        y: 748,
        width: esloganWidth,
        height: esloganHeight
      });

      page.drawImage(logoImage, {
        x: 595.28 - 40 - logoWidth,
        y: 744,
        width: logoWidth,
        height: logoHeight
      });
    } catch (_) {
      // Si falla branding, el PDF se sigue generando con contenido textual.
    }
  }

  page.drawText('ALBARAN', {
    x: 236,
    y: 680,
    size: 22,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.15)
  });

  page.drawText(`Proveedor: ${order.proveedor}`, {
    x: 50,
    y: 648,
    size: 12,
    font: font,
    color: rgb(0, 0, 0)
  });

  const tiendasTexto = Array.isArray(order.tiendas) && order.tiendas.length
    ? order.tiendas.join(', ')
    : '-';
  const direccionesTexto = Array.isArray(order.direcciones) && order.direcciones.length
    ? order.direcciones.join(' | ')
    : 'Sin direccion registrada';

  page.drawText(`Tienda(s): ${tiendasTexto}`, {
    x: 50,
    y: 630,
    size: 10,
    font,
    color: rgb(0, 0, 0)
  });

  page.drawText('Direccion(es):', {
    x: 50,
    y: 614,
    size: 10,
    font,
    color: rgb(0, 0, 0)
  });

  const yAfterDireccion = drawWrappedText(
    page,
    direccionesTexto,
    120,
    614,
    420,
    font,
    10,
    rgb(0, 0, 0),
    12
  );

  page.drawText(`Fecha: ${new Date().toLocaleString('es-ES')}`, {
    x: 50,
    y: yAfterDireccion - 8,
    size: 10,
    font: font,
    color: rgb(0, 0, 0)
  });

  let y = yAfterDireccion - 36;
  page.drawText('Producto', { x: 50, y, size: 11, font: fontBold });
  page.drawText('Cantidad', { x: 450, y, size: 11, font: fontBold });
  y -= 16;

  for (const item of order.items) {
    if (y < 60) {
      break;
    }
    page.drawText(String(item.producto || '-'), { x: 50, y, size: 10, font });
    page.drawText(String(item.cantidad_a_pedir || 0), { x: 470, y, size: 10, font });
    y -= 14;
  }

  const bytes = await pdfDoc.save();
  return bytesToBase64(bytes);
}

async function sendWithResend(apiKey: string, from: string, replyTo: string | undefined, order: ProviderOrder) {
  const pdfBase64 = await buildPdf(order);

  const payload = {
    from,
    to: order.correos,
    subject: `Pedido de productos - ${order.proveedor}`,
    html: `<p>Hola ${order.proveedor},</p><p>Adjuntamos el albaran del pedido.</p><p>Saludos.</p>`,
    ...(replyTo ? { reply_to: replyTo } : {}),
    attachments: [
      {
        filename: `Albaran_${order.proveedor.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
        content: pdfBase64
      }
    ]
  };

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Resend fallo: ${resp.status} ${text}`);
  }

  return await resp.json();
}

async function getGmailAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!tokenResp.ok) {
    const text = await tokenResp.text();
    throw new Error(`Google OAuth fallo: ${tokenResp.status} ${text}`);
  }

  const tokenJson = await tokenResp.json();
  if (!tokenJson?.access_token) {
    throw new Error('Google OAuth no devolvio access_token');
  }

  return String(tokenJson.access_token);
}

async function sendWithGmail(accessToken: string, from: string, replyTo: string | undefined, order: ProviderOrder) {
  const subject = `Pedido de productos - ${order.proveedor}`;
  const pdfBase64 = await buildPdf(order);
  const boundary = `mixed_${crypto.randomUUID()}`;

  const html = `<p>Hola ${order.proveedor},</p><p>Adjuntamos el albaran del pedido.</p><p>Saludos.</p>`;

  const headers = [
    `From: ${from}`,
    `To: ${order.correos.join(', ')}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Content-Type: multipart/mixed; boundary="${boundary}"`
  ];

  const attachmentName = `Albaran_${order.proveedor.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const mimeMessage = [
    ...headers,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    html,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${attachmentName}"`,
    `Content-Disposition: attachment; filename="${attachmentName}"`,
    'Content-Transfer-Encoding: base64',
    '',
    pdfBase64,
    '',
    `--${boundary}--`
  ].join('\r\n');

  const raw = toBase64Url(encodeUtf8ToBase64(mimeMessage));
  const sendResp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw })
  });

  if (!sendResp.ok) {
    const text = await sendResp.text();
    throw new Error(`Gmail API fallo: ${sendResp.status} ${text}`);
  }

  return await sendResp.json();
}

async function sendWithAppsScript(webhookUrl: string, webhookKey: string, sender: string, replyTo: string | undefined, order: ProviderOrder) {
  const pdfBase64 = await buildPdf(order);

  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-key': webhookKey
    },
    body: JSON.stringify({
      webhookKey,
      from: sender,
      replyTo: replyTo || sender,
      proveedor: order.proveedor,
      to: order.correos,
      subject: `Pedido de productos - ${order.proveedor}`,
      html: `<p>Hola ${order.proveedor},</p><p>Adjuntamos el albaran del pedido.</p><p>Saludos.</p>`,
      attachment: {
        filename: `Albaran_${order.proveedor.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
        mimeType: 'application/pdf',
        base64: pdfBase64
      }
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Apps Script fallo: ${resp.status} ${text}`);
  }

  const result = await resp.json().catch(() => null);
  if (!result || result.ok !== true) {
    throw new Error(`Apps Script rechazo el envio: ${result?.error || 'respuesta JSON no valida'}`);
  }

  return result;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Metodo no permitido' }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
    const defaultFrom = Deno.env.get('EMAIL_FROM') || '';
    const gmailClientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
    const gmailClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
    const gmailRefreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN') || '';
    const gmailSender = Deno.env.get('GMAIL_SENDER') || '';
    const appsScriptWebhookUrl = Deno.env.get('APPS_SCRIPT_WEBHOOK_URL') || '';
    const appsScriptWebhookKey = Deno.env.get('APPS_SCRIPT_WEBHOOK_KEY') || '';
    const appsScriptSender = Deno.env.get('APPS_SCRIPT_SENDER') || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Falta SUPABASE_URL o SUPABASE_ANON_KEY');
    }

    const hasGmail = !!(gmailClientId && gmailClientSecret && gmailRefreshToken && gmailSender);
    const hasResend = !!(resendApiKey && defaultFrom);
    const hasAppsScript = !!(appsScriptWebhookUrl && appsScriptWebhookKey && appsScriptSender);

    if (!hasAppsScript && !hasGmail && !hasResend) {
      throw new Error('No hay proveedor de envio configurado. Configura Apps Script, Gmail API o Resend');
    }

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return jsonResponse({ ok: false, error: 'Token no enviado' }, 401);
    }

    const adminClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: authData, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonResponse({ ok: false, error: 'No autorizado' }, 401);
    }

    const userEmail = String(authData.user.email || '').trim().toLowerCase();
    if (!userEmail) {
      return jsonResponse({ ok: false, error: 'No autorizado: email de usuario vacio' }, 401);
    }

    const { data: profilesByEmail, error: profileByEmailError } = await adminClient
      .from('Tabla De Perfiles')
      .select('rol, tienda_asignada, nombre_usuario')
      .ilike('nombre_usuario', userEmail)
      .limit(1);

    if (profileByEmailError) {
      return jsonResponse({ ok: false, error: `Error perfil por email: ${profileByEmailError.message}` }, 500);
    }

    const profile = Array.isArray(profilesByEmail) ? profilesByEmail[0] : null;

    const role = String(profile?.rol || '').toLowerCase().trim();
    const isAdminScope = role === 'administrador' || role === 'auxiliar_administrativo';
    const isFranquiciado = role === 'franquiciado';
    const tiendaAsignada = String(profile?.tienda_asignada || '').trim();
    const canSend = isAdminScope || isFranquiciado;
    if (!canSend) {
      return jsonResponse({ ok: false, error: 'Sin permisos' }, 403);
    }

    const body = (await req.json()) as RequestBody;
    validateBody(body);
    const gmailAccessToken = hasGmail
      ? await getGmailAccessToken(gmailClientId, gmailClientSecret, gmailRefreshToken)
      : '';

    const tiendasEnPedidos = Array.from(new Set(
      body.orders.flatMap((o) => Array.isArray(o.tiendas) ? o.tiendas : [])
        .map((t) => String(t || '').trim())
        .filter(Boolean)
    ));

    let mapaDireccionPorTienda = new Map<string, string>();
    if (tiendasEnPedidos.length > 0) {
      const { data: tiendasData, error: tiendasError } = await adminClient
        .from('Tienda de Sucursal')
        .select('nombre_tienda, direccion')
        .in('nombre_tienda', tiendasEnPedidos);

      if (!tiendasError && Array.isArray(tiendasData)) {
        mapaDireccionPorTienda = new Map(
          tiendasData.map((t) => [String(t.nombre_tienda || '').trim(), String(t.direccion || '').trim()])
        );
      }
    }

    const results: Array<{ proveedor: string; ok: boolean; detail: string }> = [];

    for (const order of body.orders) {
      if (!Array.isArray(order.correos) || order.correos.length === 0) {
        results.push({ proveedor: order.proveedor, ok: false, detail: 'Sin correos' });
        continue;
      }

      if (isFranquiciado) {
        if (!tiendaAsignada) {
          results.push({ proveedor: order.proveedor, ok: false, detail: 'Franquiciado sin tienda asignada' });
          continue;
        }

        const tiendasPedido = Array.isArray(order.tiendas)
          ? order.tiendas.map((t) => String(t || '').trim()).filter(Boolean)
          : [];

        if (!tiendasPedido.length) {
          results.push({ proveedor: order.proveedor, ok: false, detail: 'Pedido sin tienda para validacion de franquiciado' });
          continue;
        }

        const fueraDeTienda = tiendasPedido.some((t) => t !== tiendaAsignada);
        if (fueraDeTienda) {
          results.push({ proveedor: order.proveedor, ok: false, detail: `Acceso denegado para tienda(s): ${tiendasPedido.join(', ')}` });
          continue;
        }
      }

      try {
        const tiendasOrder = Array.isArray(order.tiendas)
          ? order.tiendas.map((t) => String(t || '').trim()).filter(Boolean)
          : [];
        const direccionesOrder = tiendasOrder
          .map((t) => mapaDireccionPorTienda.get(t) || '')
          .filter(Boolean);

        const enrichedOrder: ProviderOrder = {
          ...order,
          tiendas: tiendasOrder,
          direcciones: Array.from(new Set(direccionesOrder))
        };

        if (hasAppsScript) {
          await sendWithAppsScript(appsScriptWebhookUrl, appsScriptWebhookKey, appsScriptSender, body.replyTo, enrichedOrder);
          results.push({ proveedor: order.proveedor, ok: true, detail: 'Enviado (Apps Script)' });
        } else if (hasGmail) {
          await sendWithGmail(gmailAccessToken, gmailSender, body.replyTo || gmailSender, enrichedOrder);
          results.push({ proveedor: order.proveedor, ok: true, detail: 'Enviado (Gmail API)' });
        } else {
          await sendWithResend(resendApiKey, defaultFrom, body.replyTo, enrichedOrder);
          results.push({ proveedor: order.proveedor, ok: true, detail: 'Enviado (Resend)' });
        }

        await adminClient.from('envios_pedidos_log').insert({
          proveedor: order.proveedor,
          correos: order.correos,
          estado: 'enviado',
          detalle: 'OK',
          creado_por: authData.user.id
        });
      } catch (sendError) {
        const detail = sendError instanceof Error ? sendError.message : 'Error desconocido';
        results.push({ proveedor: order.proveedor, ok: false, detail });

        await adminClient.from('envios_pedidos_log').insert({
          proveedor: order.proveedor,
          correos: order.correos,
          estado: 'error',
          detalle: detail,
          creado_por: authData.user.id
        });
      }
    }

    const enviados = results.filter(r => r.ok).length;
    return jsonResponse({
      ok: enviados > 0,
      sent: enviados,
      total: results.length,
      results
    }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
