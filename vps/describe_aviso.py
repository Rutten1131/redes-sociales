import os, re, pymysql

CRM_DATABASE_URL = os.getenv('CRM_DATABASE_URL')
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', CRM_DATABASE_URL)
user, password, host, port, db = m.groups()
conn = pymysql.connect(host=host, port=int(port), user=user, password=password, database=db, cursorclass=pymysql.cursors.DictCursor)
with conn.cursor() as cur:
    cur.execute('DESCRIBE Aviso')
    for col in cur.fetchall():
        print(col['Field'], col['Type'], col['Null'], col['Default'])
conn.close()
