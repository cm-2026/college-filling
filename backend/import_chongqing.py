import pandas as pd
import mysql.connector
import math

EXCEL_PATH = r'C:/Users/Administrator/Desktop/重庆数据.xlsx'
ID_OFFSET = 500000
BATCH_SIZE = 500

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'cm1990131',
    'database': 'gaokao',
    'charset': 'utf8mb4'
}

COLUMNS = [
    'id','year','source_province','batch','subject_type','batch_remark',
    'college_code','college_name','college_major_group_code','major_group_code',
    'major_group_name','major_code','major_full_name','major_name','major_remark',
    'subject_require','major_level','school_years','tuition','group_majors',
    'group_plan_count','category','major_category','major_sector','group_position',
    'recruit_history','recommend_reason','group_admit_count_1','group_min_score_1',
    'group_min_rank_1','admit_count_1','min_score_1','min_rank_1','avg_score_1',
    'avg_rank_1','max_score_1','max_rank_1','plan_count_1','old_batch_1',
    'admit_verified','admit_count_2','min_score_2','min_rank_2','avg_score_2',
    'avg_rank_2','max_score_2','max_rank_2','plan_count_2','old_batch_2',
    'admit_count_3','min_score_3','min_rank_3','avg_score_3','avg_rank_3',
    'max_score_3','max_rank_3','plan_count_3','old_batch_3',
    'college_province','college_city','city_level'
]

def clean(val, default=None):
    if val is None:
        return default
    if isinstance(val, float) and math.isnan(val):
        return default
    return val

def to_int_safe(val, default=0):
    """安全转换为整数，处理包含字母的情况"""
    if val is None:
        return default
    if isinstance(val, float) and math.isnan(val):
        return default
    try:
        # 尝试直接转换
        return int(float(val))
    except (ValueError, TypeError):
        # 如果失败，尝试提取数字部分
        s = str(val).strip()
        digits = ''.join(c for c in s if c.isdigit())
        if digits:
            return int(digits)
        return default

print("读取Excel...")
df = pd.read_excel(EXCEL_PATH, dtype=str)
total = len(df)
print(f"共 {total} 行")

conn = mysql.connector.connect(**DB_CONFIG)
cur = conn.cursor()

placeholders = ','.join(['%s'] * len(COLUMNS))
col_names = ','.join(COLUMNS)
sql = f"INSERT INTO admission_plan ({col_names}) VALUES ({placeholders})"

success = 0
for batch_start in range(0, total, BATCH_SIZE):
    batch = df.iloc[batch_start:batch_start+BATCH_SIZE]
    rows = []
    for i, (_, row) in enumerate(batch.iterrows()):
        new_id = ID_OFFSET + batch_start + i + 1
        vals = [new_id]  # id
        for col in COLUMNS[1:]:  # 跳过id
            val = row.get(col)
            # 为 NOT NULL 字段提供默认值
            if col == 'college_code':
                # college_code 可能是字符串（如'444C'），提取数字部分
                vals.append(to_int_safe(val, 0))
            elif col == 'college_major_group_code':
                vals.append(clean(val, 0))
            elif col == 'major_group_name':
                vals.append(clean(val, ''))
            elif col == 'major_code':
                vals.append(clean(val, ''))
            elif col == 'major_full_name':
                vals.append(clean(val, ''))
            elif col == 'major_name':
                vals.append(clean(val, ''))
            elif col == 'subject_require':
                vals.append(clean(val, ''))
            elif col == 'major_level':
                vals.append(clean(val, ''))
            else:
                vals.append(clean(val))
        rows.append(tuple(vals))
    cur.executemany(sql, rows)
    conn.commit()
    success += len(rows)
    print(f"已导入 {success}/{total}")

cur.close()
conn.close()
print(f"\n[OK] 导入完成！共 {success} 条，ID范围：{ID_OFFSET+1} ~ {ID_OFFSET+success}")

# 验证
conn2 = mysql.connector.connect(**DB_CONFIG)
cur2 = conn2.cursor()
cur2.execute("SELECT source_province, COUNT(*) FROM admission_plan GROUP BY source_province")
print('\n当前各省份数据量:')
for r in cur2.fetchall():
    print(f'  {r[0]}: {r[1]}条')
conn2.close()
