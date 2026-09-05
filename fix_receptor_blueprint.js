const fs = require('fs');

const blueprint = {
  name: "RRSS - Receptor de Comentarios de Pagina (Meta)",
  flow: [
    {
      id: 1,
      module: "facebook-pages:MakeAnApiCall",
      version: 6,
      parameters: {
        __IMTCONN__: 10746705
      },
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
        restore: {
          parameters: {
            __IMTCONN__: {
              data: { scoped: "true", connection: "facebook" },
              label: "My Facebook connection (Objetivo Cesar Reyes)"
            }
          }
        },
        parameters: [
          {
            name: "__IMTCONN__",
            type: "account:facebook",
            label: "Connection",
            required: true
          }
        ],
        expect: [
          { name: "url", type: "text", label: "URL", required: true },
          { name: "method", type: "select", label: "Method", required: true },
          { name: "headers", type: "array", label: "Headers" },
          { name: "qs", type: "array", label: "Query String" },
          { name: "body", type: "any", label: "Body" }
        ]
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
        restore: {
          expect: {
            array: { mode: "edit" }
          }
        },
        expect: [
          { mode: "edit", name: "array", spec: [], type: "array", label: "Array" }
        ]
      }
    },
    {
      id: 3,
      module: "builtin:BasicFeeder",
      version: 1,
      parameters: {},
      filter: {
        name: "Tiene Comentarios",
        conditions: [
          [
            { a: "{{2.comments.data}}", o: "exist" }
          ]
        ]
      },
      mapper: {
        array: "{{2.comments.data}}"
      },
      metadata: {
        designer: { x: 600, y: 0, name: "Recorrer Comentarios" },
        restore: {
          expect: {
            array: { mode: "edit" }
          }
        },
        expect: [
          { mode: "edit", name: "array", spec: [], type: "array", label: "Array" }
        ]
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
        headers: [
          { key: "Content-Type", value: "application/json" }
        ],
        body: "{\n  \"platform\": \"FACEBOOK\",\n  \"type\": \"COMMENT\",\n  \"externalId\": \"{{3.id}}\",\n  \"parentId\": \"{{2.id}}\",\n  \"fromName\": \"{{ifempty(3.from.name, 'Usuario Facebook')}}\",\n  \"fromExternalId\": \"{{3.from.id}}\",\n  \"content\": \"{{3.message}}\",\n  \"accountExternalId\": \"275810677566214\"\n}",
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

fs.writeFileSync('make_scenario_blueprint_inbox_receptor_feed.json', JSON.stringify(blueprint, null, 2));
console.log('OK: make_scenario_blueprint_inbox_receptor_feed.json corregido con BasicFeeder y conexion validada');
