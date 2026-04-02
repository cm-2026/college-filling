import mysql.connector
conn = mysql.connector.connect(host='localhost', user='root', password='cm1990131', database='gaokao')
cur = conn.cursor()

# 统计min_rank_1字段情况
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN min_rank_1 IS NULL THEN 1 END) as null_cnt,
        COUNT(CASE WHEN min_rank_1 = 0 THEN 1 END) as zero_cnt,
        COUNT(CASE WHEN min_rank_1 > 0 THEN 1 END) as has_val
    FROM admission_plan WHERE source_province='河南'
""")
row = cur.fetchone()
print(f"河南 min_rank_1: 总计={row[0]}, NULL={row[1]}, 0值={row[2]}, 有效值={row[3]}")

# 查几条有值的样本
cur.execute("""
    SELECT min_rank_1, group_min_rank_1, min_score_1, college_name, major_name 
    FROM admission_plan 
    WHERE source_province='河南' AND min_rank_1 > 0
    LIMIT 5
""")
rows = cur.fetchall()
print("\n有效min_rank_1样本:")
for r in rows:
    print(f"  min_rank_1={r[0]}, group_min_rank_1={r[1]}, score={r[2]}, 院校={r[3]}, 专业={r[4]}")

# 查几条0值的样本
cur.execute("""
    SELECT min_rank_1, group_min_rank_1, min_score_1, college_name, major_name 
    FROM admission_plan 
    WHERE source_province='河南' AND (min_rank_1 = 0 OR min_rank_1 IS NULL)
    LIMIT 5
""")
rows = cur.fetchall()
print("\nmin_rank_1为0或NULL的样本:")
for r in rows:
    print(f"  min_rank_1={r[0]}, group_min_rank_1={r[1]}, score={r[2]}, 院校={r[3]}, 专业={r[4]}")

conn.close()
