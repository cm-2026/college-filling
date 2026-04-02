import mysql.connector

conn = mysql.connector.connect(
    host='localhost',
    user='root',
    password='cm1990131',
    database='gaokao'
)
cur = conn.cursor()

print("=== 北京数据 subject_require 分布 ===")
cur.execute("SELECT subject_require, COUNT(*) as cnt FROM admission_plan WHERE source_province='北京' GROUP BY subject_require ORDER BY cnt DESC LIMIT 30")
for r in cur.fetchall():
    print(r)

print("\n=== 北京数据 subject_type 分布 ===")
cur.execute("SELECT subject_type, COUNT(*) as cnt FROM admission_plan WHERE source_province='北京' GROUP BY subject_type ORDER BY cnt DESC")
for r in cur.fetchall():
    print(r)

print("\n=== 北京数据样本（前5条）===")
cur.execute("SELECT college_name, major_name, subject_type, subject_require FROM admission_plan WHERE source_province='北京' LIMIT 5")
for r in cur.fetchall():
    print(r)

conn.close()
