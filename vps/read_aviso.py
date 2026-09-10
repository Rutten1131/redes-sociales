import pymysql

conn = pymysql.connect(
    host='mysql.us.stackcp.com',
    port=43552,
    user='crmempresa-3139303493',
    password='uqz4z2aok4',
    database='crmempresa-3139303493'
)
cur = conn.cursor()
cur.execute('SELECT id, titulo, fechaProg, estado, recordatorio1hEnviado, recordatorio30minEnviado, recordatorio10minEnviado FROM Aviso ORDER BY createdAt DESC LIMIT 2')
for r in cur.fetchall():
    print(r)
