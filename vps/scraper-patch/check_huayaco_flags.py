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
    cur.execute("SELECT id, titulo, fechaProg, estado, recordatorio1hEnviado, recordatorio30minEnviado, recordatorio10minEnviado FROM Aviso WHERE id = 'c2705432568ce4adeb5886577'")
    print(cur.fetchone())
