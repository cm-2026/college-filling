import mysql.connector
conn = mysql.connector.connect(host='localhost', user='root', password='cm1990131', database='gaokao')
cur = conn.cursor()

# 直接测试查询
score = 550
cur.execute("""
SELECT COUNT(*) FROM admission_plan 
WHERE source_province='河南' 
AND subject_type='物理'
AND group_min_score_1 <= %s
""", (score,))
print("group_min_score_1 <= 550, subject_type=物理:", cur.fetchone())

cur.execute("""
SELECT COUNT(*) FROM admission_plan 
WHERE source_province='河南' 
AND subject_type='物理'
""")
print("source_province=河南, subject_type=物理 总数:", cur.fetchone())

# 看group_min_score_1的范围
cur.execute("""
SELECT MIN(group_min_score_1), MAX(group_min_score_1), AVG(group_min_score_1)
FROM admission_plan WHERE source_province='河南' AND subject_type='物理'
""")
print("分数范围:", cur.fetchone())

# 看有多少条group_min_score_1为NULL
cur.execute("""
SELECT COUNT(*) FROM admission_plan 
WHERE source_province='河南' AND subject_type='物理' AND group_min_score_1 IS NULL
""")
print("group_min_score_1为NULL的条数:", cur.fetchone())

conn.close()
