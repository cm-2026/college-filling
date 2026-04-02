import mysql.connector

conn = mysql.connector.connect(
    host='localhost',
    user='root',
    password='cm1990131',
    database='gaokao'
)
cur = conn.cursor(dictionary=True)

# 模拟3+3查询：北京，分数600，选科：物理、化学、历史
source_province = '北京'
score = 600
subjects = ['物理', '化学', '历史']

# 生成两门组合
pairs2 = []
for i in range(len(subjects)):
    for j in range(len(subjects)):
        if i != j:
            pairs2.append(f"{subjects[i]}和{subjects[j]}")

singles = subjects

SELECT_COLS = """
    college_name, college_code, major_name, major_code,
    major_group_name AS major_group, major_group_code,
    group_min_score_1, group_min_rank_1,
    min_score_1 AS min_score, min_rank_1 AS min_rank,
    subject_type, subject_require, recommend_reason
"""

BASE_WHERE = "source_province = %s AND group_min_score_1 <= %s"

pairs2_ph = ','.join(['%s'] * len(pairs2))
singles_ph = ','.join(['%s'] * len(singles))

query = f"""
    SELECT {SELECT_COLS}, 1 AS match_priority
    FROM admission_plan
    WHERE {BASE_WHERE}
      AND subject_require IN ({pairs2_ph})

    UNION ALL

    SELECT {SELECT_COLS}, 2 AS match_priority
    FROM admission_plan
    WHERE {BASE_WHERE}
      AND subject_require IN ({singles_ph})
      AND subject_require NOT IN ({pairs2_ph})

    UNION ALL

    SELECT {SELECT_COLS}, 3 AS match_priority
    FROM admission_plan
    WHERE {BASE_WHERE}
      AND (subject_require = '不限' OR subject_require IS NULL OR subject_require = '')
      AND subject_require NOT IN ({pairs2_ph})
      AND subject_require NOT IN ({singles_ph})

    ORDER BY match_priority ASC, group_min_score_1 DESC, min_score DESC
"""

params = (
    # priority=1
    source_province, score, *pairs2,
    # priority=2
    source_province, score, *singles, *pairs2,
    # priority=3
    source_province, score, *pairs2, *singles
)

cur.execute(query, params)
rows = cur.fetchall()

print(f"总查询结果：{len(rows)} 条")
print("\n按优先级分布：")
from collections import Counter
cnt = Counter(r['match_priority'] for r in rows)
for p in sorted(cnt):
    label = {1: '满足2门', 2: '满足1门', 3: '不限/空值'}[p]
    print(f"  priority={p} ({label}): {cnt[p]} 条")

print("\n前10条：")
for r in rows[:10]:
    p_label = {1: '满足2门', 2: '满足1门', 3: '不限/空值'}[r['match_priority']]
    print(f"  [{p_label}] {r['college_name']} - {r['major_name']} | subject_require={r['subject_require']} | 组最低分={r['group_min_score_1']}")

conn.close()
