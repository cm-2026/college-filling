import mysql.connector
conn = mysql.connector.connect(host='localhost', user='root', password='cm1990131', database='gaokao')
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM admission_plan WHERE source_province='福建'")
print('福建数据条数:', cur.fetchone()[0])
cur.execute("SELECT MAX(id) FROM admission_plan")
print('最大ID:', cur.fetchone()[0])
cur.execute("SELECT id, college_name, major_name, source_province FROM admission_plan WHERE source_province='福建' LIMIT 3")
for r in cur.fetchall():
    print(r)
conn.close()
