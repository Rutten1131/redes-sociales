import os, re, pymysql

CRM_DATABASE_URL = os.getenv('CRM_DATABASE_URL')
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', CRM_DATABASE_URL)
user, password, host, port, db = m.groups()
conn = pymysql.connect(host=host, port=int(port), user=user, password=password, database=db, cursorclass=pymysql.cursors.DictCursor)

with conn.cursor() as cur:
    cur.execute('SELECT * FROM Aviso ORDER BY createdAt DESC LIMIT 1')
    print('EJEMPLO AVISO:', cur.fetchone())
conn.close()
