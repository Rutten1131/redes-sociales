import os, re, pymysql, requests

CRM_DATABASE_URL = os.getenv('CRM_DATABASE_URL')
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', CRM_DATABASE_URL)
if m:
    user, password, host, port, db = m.groups()
    conn = pymysql.connect(host=host, port=int(port), user=user, password=password, database=db, cursorclass=pymysql.cursors.DictCursor)
    with conn.cursor() as cur:
        cur.execute('SELECT count(*) as total FROM `Lead`')
        print('TOTAL LEADS EN CRM:', cur.fetchone())
        cur.execute('SELECT count(*) as total FROM `Aviso`')
        print('TOTAL AVISOS EN CRM:', cur.fetchone())
    conn.close()

evo_url = 'http://178.238.238.158:8080/instance/fetchInstances'
headers = {'apikey': '42a447c1-3d74-4b52-9571-042c174f7621'}
try:
    r = requests.get(evo_url, headers=headers)
    print('EVOLUTION STATUS:', r.status_code)
    if r.status_code == 200:
        for inst in r.json():
            print('INSTANCIA:', inst.get('name'), '| STATUS:', inst.get('connectionStatus'))
except Exception as e:
    print('ERROR EVOLUTION:', e)
