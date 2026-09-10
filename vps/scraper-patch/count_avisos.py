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
    cur.execute("SELECT COUNT(*) as total FROM Aviso")
    print("TOTAL FILAS EN AVISO:", cur.fetchone())
    cur.execute("SELECT id, titulo, fechaProg, createdAt FROM Aviso ORDER BY createdAt DESC LIMIT 5")
    print("ULTIMAS 5 FILAS POR createdAt:")
    for r in cur.fetchall():
        print(r)
