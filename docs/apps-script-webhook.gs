/**
 * Webhook de correo para Brasil Acai.
 *
 * Configuracion inicial:
 * 1. En Apps Script: Project Settings > Script Properties.
 * 2. Crea WEBHOOK_KEY con la misma clave configurada en la app/Supabase.
 * 3. Deploy > New deployment > Web app; Execute as: Me; Who has access: Anyone.
 * 4. Copia la URL terminada en /exec (no /dev) a la configuracion de la app.
 * 5. Cada vez que edites el script, crea una nueva version del deployment.
 */

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var expectedKey = props.getProperty('WEBHOOK_KEY');
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var body = JSON.parse(raw);

    // Apps Script no expone de forma fiable las cabeceras personalizadas de la peticion.
    // El backend envia la clave dentro del JSON, y el envio directo antiguo tambien.
    var receivedKey = String(body.webhookKey || (e && e.parameter && e.parameter.key) || '');
    if (!expectedKey || !receivedKey || receivedKey !== expectedKey) {
      return jsonResponse({ ok: false, error: 'unauthorized' });
    }

    var recipients = normalizeRecipients(body.to);
    if (!recipients.length) {
      return jsonResponse({ ok: false, error: 'missing_to' });
    }

    var subject = String(body.subject || 'Pedido Brasil Acai').slice(0, 250);
    var html = String(body.html || '<p>Adjuntamos el pedido.</p>');
    var replyTo = String(body.replyTo || body.senderEmail || '').trim();
    var options = { htmlBody: html };

    // MailApp envia desde la cuenta que autorizo/desplego el script.
    // senderEmail se recibe por compatibilidad con la app, pero no puede cambiar
    // la cuenta remitente. Se usa como replyTo si no se especifico otro.
    if (replyTo && isValidEmail(replyTo)) options.replyTo = replyTo;

    var attachment = body.attachment;
    if (attachment && attachment.base64) {
      var base64 = String(attachment.base64).replace(/^data:[^,]+,/, '').replace(/\s/g, '');
      var bytes = Utilities.base64Decode(base64);
      var filename = String(attachment.filename || 'Pedido.pdf').replace(/[\\/:*?"<>|]/g, '_');
      var mimeType = String(attachment.mimeType || 'application/pdf');
      options.attachments = [Utilities.newBlob(bytes, mimeType, filename)];
    }

    MailApp.sendEmail(recipients.join(','), subject, 'Adjuntamos el pedido.', options);
    return jsonResponse({ ok: true, sent: recipients.length });
  } catch (err) {
    var message = err && err.message ? err.message : String(err);
    return jsonResponse({ ok: false, error: message });
  }
}

function normalizeRecipients(value) {
  var values = Array.isArray(value) ? value : String(value || '').split(/[;,\n]/);
  return values.map(function (item) { return String(item || '').trim(); })
    .filter(function (email) { return isValidEmail(email); });
}

function isValidEmail(email) {
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(String(email || '').trim());
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
