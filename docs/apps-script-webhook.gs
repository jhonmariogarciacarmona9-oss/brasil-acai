function doPost(e) {
  try {
    var webhookKey = PropertiesService.getScriptProperties().getProperty('WEBHOOK_KEY');
    var sentKey = (e && e.postData && e.postData.type) ? (e.parameter && e.parameter.key) : null;

    // Allow key in header fallback via body key because Apps Script does not expose custom headers in doPost.
    var body = JSON.parse((e && e.postData && e.postData.contents) ? e.postData.contents : '{}');
    if (!sentKey && body && body.webhookKey) {
      sentKey = body.webhookKey;
    }

    if (!webhookKey || sentKey !== webhookKey) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var to = Array.isArray(body.to) ? body.to.join(',') : String(body.to || '');
    var subject = String(body.subject || 'Pedido');
    var html = String(body.html || '<p>Pedido adjunto</p>');
    var replyTo = String(body.replyTo || '');

    if (!to) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'missing_to' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var options = {
      htmlBody: html
    };

    if (replyTo) {
      options.replyTo = replyTo;
    }

    if (body.attachment && body.attachment.base64) {
      var filename = String(body.attachment.filename || 'albaran.pdf');
      var mimeType = String(body.attachment.mimeType || 'application/pdf');
      var bytes = Utilities.base64Decode(String(body.attachment.base64));
      var blob = Utilities.newBlob(bytes, mimeType, filename);
      options.attachments = [blob];
    }

    MailApp.sendEmail(to, subject, 'Pedido adjunto en PDF', options);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
