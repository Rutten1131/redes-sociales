const fs = require('fs');

// Leer el modulo exacto 107 que funciona perfectamente en tu escenario principal
const originalBp = JSON.parse(fs.readFileSync('make_scenario_blueprint_cesar_reyes_historias_final.json', 'utf8'));

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

const m107 = findById(originalBp.flow, 107);

const finalBp = {
  name: "RRSS - Receptor de Comentarios de Pagina (Meta)",
  flow: [
    {
      id: 1,
      module: m107.module,
      version: m107.version,
      parameters: m107.parameters,
      mapper: {
        url: "/275810677566214/feed",
        method: "GET",
        qs: [
          { name: "fields", value: "id,comments{id,from,message,created_time}" },
          { name: "limit", value: "10" }
        ]
      },
      metadata: {
        designer: { x: 0, y: 0, name: "Obtener Feed de la Pagina" },
        restore: m107.metadata.restore,
        parameters: m107.metadata.parameters,
        expect: m107.metadata.expect
      }
    },
    {
      id: 2,
      module: "builtin:BasicFeeder",
      version: 1,
      parameters: {},
      mapper: {
        array: "{{1.body.data}}"
      },
      metadata: {
        designer: { x: 300, y: 0, name: "Recorrer Posts" },
        restore: { expect: { array: { mode: "edit" } } },
        expect: [{ mode: "edit", name: "array", spec: [], type: "array", label: "Array" }]
      }
    },
    {
      id: 3,
      module: "builtin:BasicFeeder",
      version: 1,
      parameters: {},
      filter: {
        name: "Tiene Comentarios",
        conditions: [[{ a: "{{2.comments.data}}", o: "exist" }]]
      },
      mapper: {
        array: "{{2.comments.data}}"
      },
      metadata: {
        designer: { x: 600, y: 0, name: "Recorrer Comentarios" },
        restore: { expect: { array: { mode: "edit" } } },
        expect: [{ mode: "edit", name: "array", spec: [], type: "array", label: "Array" }]
      }
    },
    {
      id: 4,
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
        body: '{\n  "platform": "FACEBOOK",\n  "type": "COMMENT",\n  "externalId": "{{3.id}}",\n  "parentId": "{{2.id}}",\n  "fromName": "{{ifempty(3.from.name, \'Usuario Facebook\')}}",\n  "fromExternalId": "{{3.from.id}}",\n  "content": "{{3.message}}",\n  \"accountExternalId\": \"275810677566214\"\n}',
        parseResponse: true,
        stopOnHttpError: true,
        allowRedirects: true,
        shareCookies: false,
        requestCompressedContent: true
      },
      metadata: {
        designer: { x: 900, y: 0, name: "Enviar a Inbox de la App" }
      }
    }
  ]
};

fs.writeFileSync('make_scenario_blueprint_inbox_receptor_feed.json', JSON.stringify(finalBp, null, 2));
console.log('OK! Blueprint final del receptor generado a la perfeccion.');
