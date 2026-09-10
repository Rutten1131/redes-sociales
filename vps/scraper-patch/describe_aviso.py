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
    cur.execute("DESCRIBE Aviso")
    cols = cur.fetchall()
    print("=== ESTRUCTURA DE LA TABLA Aviso ===")
    for c in cols:
        print(f"Columna: {c['Field']} | Tipo: {c['Type']}")
