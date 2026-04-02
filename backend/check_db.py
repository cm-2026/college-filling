import mysql.connector
conn = mysql.connector.connect(host='localhost', user='root', password='cm1990131', database='gaokao')
cur = conn.cursor()
cur.execute('SELECT COUNT(*), MIN(id), MAX(id) FROM admission_plan')
print('count, min_id, max_id:', cur.fetchone())
cur.execute('SELECT source_province, COUNT(*) FROM admission_plan GROUP BY source_province')
for r in cur.fetchall():
    print(r)
conn.close()
