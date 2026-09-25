const https = require('https');

const payload = JSON.stringify({
  platform: "FACEBOOK",
  type: "COMMENT",
  externalId: "sample_comment_12345",
  fromExternalId: "user_fb_67890",
  replyMessage: "¡Hola! Gracias por comentar en Agenda Cultural Loja 🎭",
  businessId: "agenda_cultural_sample",
  businessName: "Agenda Cultural Loja",
  accessToken: "sample_token_mock",
  pageAccessToken: "sample_token_mock"
});

const req = https.request(
  'https://hook.us2.make.com/113xh8karevtiaenmkcq29iagotcb7db',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  },
  (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('STATUS:', res.statusCode);
      console.log('RESPONSE:', data);
    });
  }
);

req.on('error', (e) => {
  console.error('ERROR:', e.message);
});

req.write(payload);
req.end();
