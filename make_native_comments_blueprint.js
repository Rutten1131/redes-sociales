const fs = require('fs');

const bp = JSON.parse(fs.readFileSync('make_scenario_blueprint_cesar_reyes_limpio.json', 'utf8'));

function findById(flow, id) {
  for (const m of flow) {
    if (m.id === id) return m;
    if (m.routes) {
      for (const r of m.routes) {
        const found = findById(r.flow, id);
        if (found) return found;
      }
    }
  }
}

const fb49 = findById(bp.flow, 49);

const nativeBp = {
  name: "RRSS - Receptor de Comentarios de Pagina (Meta)",
  flow: [
    {
      id: 1,
      module: "facebook-pages:ListPosts",
      version: 1,
      parameters: fb49.parameters,
      mapper: {
        page: "275810677566214",
        limit: 5
      },
      metadata: {
        designer: { x: 0, y: 0, name: "Facebook Pages - List Posts" },
        restore: fb49.metadata.restore
      }
    },
    {
      id: 2,
      module: "facebook-pages:ListComments",
      version: 1,
      parameters: fb49.parameters,
      mapper: {
        post: "{{1.id}}",
        limit: 10
      },
      metadata: {
        designer: { x: 300, y: 0, name: "Facebook Pages - List Comments" },
        restore: fb49.metadata.restore
      }
    },
    {
      id: 3,
      module: "http:MakeRequest",
      version: 4,
      parameters: {
        tlsType: "",
        proxyKeychain: "",
        authenticationType: "noAuth"
      },
      mapper: {
        url: "https://redes-sociales-l5q4.vercel.app/api/webhooks/make-inbox",
        method: "post",
        headers: [{ key: "Content-Type", value: "application/json" }],
        body: '{\n  "platform": "FACEBOOK",\n  "type": "COMMENT",\n  "externalId": "{{2.id}}",\n  "parentId": "{{1.id}}",\n  "fromName": "{{ifempty(2.from.name, \'Usuario Facebook\')}}",\n  "fromExternalId": "{{2.from.id}}",\n  "content": "{{2.message}}",\n  "accountExternalId": "275810677566214"\n}',
        parseResponse: true,
        stopOnHttpError: true,
        allowRedirects: true,
        shareCookies: false,
        requestCompressedContent: true
      },
      metadata: {
        designer: { x: 600, y: 0, name: "Enviar a Inbox de la App" }
      }
    }
  ]
};

fs.writeFileSync('make_scenario_blueprint_inbox_receptor_feed.json', JSON.stringify(nativeBp, null, 2));
console.log('OK! make_scenario_blueprint_inbox_receptor_feed.json 100% nativo con List Posts y List Comments');
