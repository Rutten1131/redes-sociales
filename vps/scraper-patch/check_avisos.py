import os
import re
import pymysql

db_url = os.environ.get("CRM_DATABASE_URL")
m = re.match(r"mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)", db_url)
user, pwd, host, port, db = m.groups()

conn = pymysql.connect(
    host=host,
    port=int(port),
    user=user,
    password=pwd,
    database=db,
    cursorclass=pymysql.cursors.DictCursor
)

with conn.cursor() as cur:
    cur.execute("SELECT * FROM Aviso ORDER BY id DESC LIMIT 10")
    rows = cur.fetchall()
    print(f"Total avisos encontrados: {len(rows)}")
    for r in rows:
        print("--------------------------------------------------")
        print(f"ID: {r.get('id')}")
        print(f"Título: {r.get('titulo')}")
        print(f"Mensaje: {r.get('mensaje')}")
        print(f"Fecha Prog: {r.get('fechaProg')}")
        print(f"Alertas: 1h={r.get('recordatorio1hEnviado')}, 30m={r.get('recordatorio30mEnviado')}, 10m={r.get('recordatorio10mEnviado')}")
