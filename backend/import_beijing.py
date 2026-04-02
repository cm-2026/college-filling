import pandas as pd
import mysql.connector
import math

# ── 读取Excel ──────────────────────────────────────────
df = pd.read_excel('C:/Users/Administrator/Desktop/北京数据.xlsx')
print(f'Excel行数: {len(df)}')

# ── 辅助函数 ──────────────────────────────────────────
def to_int(v, default=None):
    try:
        if v is None or (isinstance(v, float) and math.isnan(v)):
            return default
        return int(float(v))
    except:
        return default

def to_str(v, default=None):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return default
    s = str(v).strip()
    return s if s and s.lower() != 'nan' else default

# ── ID偏移量 ───────────────────────────────────────────
ID_OFFSET = 100000  # 北京数据 ID = 行号(1~5751) + 100000

# ── 数据库连接 ─────────────────────────────────────────
conn = mysql.connector.connect(
    host='localhost', user='root', password='cm1990131', database='gaokao'
)
cur = conn.cursor()

INSERT_SQL = """
INSERT INTO admission_plan (
    id, year, source_province, batch, subject_type, batch_remark,
    college_code, college_name, college_major_group_code,
    major_group_code, major_group_name, major_code, major_full_name, major_name,
    major_remark, subject_require, major_level, school_years, tuition,
    group_majors, group_plan_count, category, major_category, major_sector,
    group_position, recruit_history, recommend_reason,
    group_admit_count_1, group_min_score_1, group_min_rank_1,
    admit_count_1, min_score_1, min_rank_1, avg_score_1, avg_rank_1, max_score_1, max_rank_1, plan_count_1, old_batch_1,
    admit_verified,
    admit_count_2, min_score_2, min_rank_2, avg_score_2, avg_rank_2, max_score_2, max_rank_2, plan_count_2, old_batch_2,
    admit_count_3, min_score_3, min_rank_3, avg_score_3, avg_rank_3, max_score_3, max_rank_3, plan_count_3, old_batch_3,
    college_province, college_city, city_level
) VALUES (
    %s,%s,%s,%s,%s,%s,
    %s,%s,%s,
    %s,%s,%s,%s,%s,
    %s,%s,%s,%s,%s,
    %s,%s,%s,%s,%s,
    %s,%s,%s,
    %s,%s,%s,
    %s,%s,%s,%s,%s,%s,%s,%s,%s,
    %s,
    %s,%s,%s,%s,%s,%s,%s,%s,%s,
    %s,%s,%s,%s,%s,%s,%s,%s,%s,
    %s,%s,%s
)
"""

batch_data = []
success, fail = 0, 0
BATCH_SIZE = 500

for idx, row in df.iterrows():
    row_num = idx + 1
    try:
        rec = (
            row_num + ID_OFFSET,                        # id
            to_int(row['year'], 2025),                  # year
            to_str(row['source_province'], '北京'),     # source_province
            to_str(row['batch'], ''),                   # batch
            to_str(row['subject_type'], ''),            # subject_type
            to_str(row.get('batch_remark')),            # batch_remark
            to_int(row['college_code'], 0),             # college_code
            to_str(row['college_name'], ''),            # college_name
            to_int(row['college_major_group_code'], 0), # college_major_group_code
            to_str(row.get('major_group_code')),        # major_group_code
            to_str(row['major_group_name'], ''),        # major_group_name
            to_str(row['major_code'], ''),              # major_code
            to_str(row['major_full_name'], to_str(row['major_name'], '')),  # major_full_name
            to_str(row['major_name'], ''),              # major_name
            to_str(row.get('major_remark')),            # major_remark
            to_str(row['subject_require'], ''),         # subject_require
            to_str(row['major_level'], ''),             # major_level
            to_int(row.get('school_years')),            # school_years
            to_str(row.get('tuition')),                 # tuition
            to_str(row.get('group_majors')),            # group_majors
            to_int(row.get('group_plan_count')),        # group_plan_count
            to_str(row.get('category')),                # category
            to_str(row.get('major_category')),          # major_category
            to_str(row.get('major_sector')),            # major_sector
            to_str(row.get('group_position')),          # group_position
            to_str(row.get('recruit_history')),         # recruit_history
            to_str(row.get('recommend_reason')),        # recommend_reason
            to_int(row.get('group_admit_count_1')),     # group_admit_count_1
            to_int(row.get('group_min_score_1')),       # group_min_score_1
            to_int(row.get('group_min_rank_1')),        # group_min_rank_1
            to_int(row.get('admit_count_1')),           # admit_count_1
            to_int(row.get('min_score_1')),             # min_score_1
            to_int(row.get('min_rank_1')),              # min_rank_1
            to_int(row.get('avg_score_1')),             # avg_score_1
            to_int(row.get('avg_rank_1')),              # avg_rank_1
            to_int(row.get('max_score_1')),             # max_score_1
            to_int(row.get('max_rank_1')),              # max_rank_1
            to_int(row.get('plan_count_1')),            # plan_count_1
            to_str(row.get('old_batch_1')),             # old_batch_1
            to_str(row.get('admit_verified')),          # admit_verified
            to_int(row.get('admit_count_2')),           # admit_count_2
            to_int(row.get('min_score_2')),             # min_score_2
            to_int(row.get('min_rank_2')),              # min_rank_2
            to_int(row.get('avg_score_2')),             # avg_score_2
            to_int(row.get('avg_rank_2')),              # avg_rank_2
            to_int(row.get('max_score_2')),             # max_score_2
            to_int(row.get('max_rank_2')),              # max_rank_2
            to_int(row.get('plan_count_2')),            # plan_count_2
            to_str(row.get('old_batch_2')),             # old_batch_2
            to_int(row.get('admit_count_3')),           # admit_count_3
            to_int(row.get('min_score_3')),             # min_score_3
            to_int(row.get('min_rank_3')),              # min_rank_3
            to_int(row.get('avg_score_3')),             # avg_score_3
            to_int(row.get('avg_rank_3')),              # avg_rank_3
            to_int(row.get('max_score_3')),             # max_score_3
            to_int(row.get('max_rank_3')),              # max_rank_3
            to_int(row.get('plan_count_3')),            # plan_count_3
            to_str(row.get('old_batch_3')),             # old_batch_3
            to_str(row.get('college_province')),        # college_province
            to_str(row.get('college_city')),            # college_city
            to_str(row.get('city_level')),              # city_level
        )
        batch_data.append(rec)
        success += 1
    except Exception as e:
        print(f'  行{row_num} 构建失败: {e}')
        fail += 1

    # 批量写入
    if len(batch_data) >= BATCH_SIZE:
        cur.executemany(INSERT_SQL, batch_data)
        conn.commit()
        print(f'  已插入 {success} 条...')
        batch_data = []

# 写入剩余
if batch_data:
    cur.executemany(INSERT_SQL, batch_data)
    conn.commit()

conn.close()
print(f'\n导入完成: 成功 {success} 条, 失败 {fail} 条')

# 验证
conn2 = mysql.connector.connect(host='localhost', user='root', password='cm1990131', database='gaokao')
cur2 = conn2.cursor()
cur2.execute("SELECT source_province, COUNT(*) FROM admission_plan GROUP BY source_province")
print('\n当前各省份数据量:')
for r in cur2.fetchall():
    print(f'  {r[0]}: {r[1]}条')
conn2.close()
