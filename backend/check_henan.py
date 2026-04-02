import mysql.connector
conn = mysql.connector.connect(host='localhost', user='root', password='cm1990131', database='gaokao')
cur = conn.cursor()
cur.execute("SELECT DISTINCT subject_type, COUNT(*) FROM admission_plan WHERE source_province='河南' GROUP BY subject_type")
for r in cur.fetchall(): print(r)
print('---')
cur.execute("SELECT DISTINCT subject_require FROM admission_plan WHERE source_province='河南' LIMIT 20")
for r in cur.fetchall(): print(r)
conn.close()
