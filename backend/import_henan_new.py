"""
清空 admission_plan 表，将河南数据.xlsx 重新导入
新Excel与旧版差异：
  - 无 ID 列（用行号+1自动生成）
  - 无 专业全称 列（major_full_name 用 专业名称 代替）
  - 无 录取测试 列（admit_verified 置 NULL）
"""
import pandas as pd
import mysql.connector
import math

EXCEL_FILE = 'C:/Users/Administrator/Desktop/河南数据.xlsx'

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'cm1990131',
    'database': 'gaokao',
    'charset': 'utf8mb4',
}

INSERT_SQL = """
INSERT INTO admission_plan (
  id, year, source_province, batch, subject_type, batch_remark,
  college_code, college_name, college_major_group_code, major_group_code,
  major_group_name, major_code, major_full_name, major_name, major_remark,
  subject_require, major_level, school_years, tuition, group_majors,
  group_plan_count, category, major_category, major_sector, group_position,
  recruit_history, recommend_reason,
  group_admit_count_1, group_min_score_1, group_min_rank_1,
  admit_count_1, min_score_1, min_rank_1, avg_score_1, avg_rank_1,
  max_score_1, max_rank_1, plan_count_1, old_batch_1, admit_verified,
  admit_count_2, min_score_2, min_rank_2, avg_score_2, avg_rank_2,
  max_score_2, max_rank_2, plan_count_2, old_batch_2,
  admit_count_3, min_score_3, min_rank_3, avg_score_3, avg_rank_3,
  max_score_3, max_rank_3, plan_count_3, old_batch_3,
  college_province, college_city, city_level
) VALUES (
  %s,%s,%s,%s,%s,%s,
  %s,%s,%s,%s,
  %s,%s,%s,%s,%s,
  %s,%s,%s,%s,%s,
  %s,%s,%s,%s,%s,
  %s,%s,
  %s,%s,%s,
  %s,%s,%s,%s,%s,
  %s,%s,%s,%s,%s,
  %s,%s,%s,%s,%s,
  %s,%s,%s,%s,
  %s,%s,%s,%s,%s,
  %s,%s,%s,%s,
  %s,%s,%s
)
"""

def clean(val):
    if val is None:
        return None
    if isinstance(val, float) and math.isnan(val):
        return None
    try:
        if pd.isna(val):
            return None
    except Exception:
        pass
    return val

def to_int(val):
    v = clean(val)
    if v is None:
        return None
    try:
        return int(float(str(v)))
    except Exception:
        return None

def to_str(val):
    v = clean(val)
    if v is None:
        return None
    return str(v).strip() or None

def row_to_tuple(row_id, row):
    major_name = to_str(row['专业名称'])
    return (
        row_id,                              # id（行号）
        to_int(row['年份']),
        to_str(row['生源地']),
        to_str(row['批次']),
        to_str(row['科类']),
        to_str(row['批次备注']),
        to_int(row['院校代码']),
        to_str(row['院校名称']),
        to_int(row['院校专业组代码']),
        to_str(row['专业组代码']),
        to_str(row['专业组名称']),
        to_str(row['专业代码']),
        major_name,                          # major_full_name 用专业名称替代
        major_name,                          # major_name
        to_str(row['专业备注']),
        to_str(row['选科要求']),
        to_str(row['专业层次']),
        to_int(row['学制']),
        to_str(row['学费']),
        to_str(row['组内专业']),
        to_int(row['专业组计划人数']),
        to_str(row['门类']),
        to_str(row['专业类']),
        to_str(row['专业版块']),
        to_str(row['专业组定位']),
        to_str(row['历年招生数量']),
        to_str(row['选择原因']),
        to_int(row['专业组录取人数1']),
        to_int(row['专业组最低分1']),
        to_int(row['专业组最低位次1']),
        to_int(row['录取人数1']),
        to_int(row['最低分1']),
        to_int(row['最低位次1']),
        to_int(row['平均分1']),
        to_int(row['平均位次1']),
        to_int(row['最高分1']),
        to_int(row['最高位次1']),
        to_int(row['计划人数1']),
        to_str(row['老批次1']),
        None,                                # admit_verified（新表无此列）
        to_int(row['录取人数2']),
        to_int(row['最低分2']),
        to_int(row['最低位次2']),
        to_int(row['平均分2']),
        to_int(row['平均位次2']),
        to_int(row['最高分2']),
        to_int(row['最高位次2']),
        to_int(row['计划人数2']),
        to_str(row['老批次2']),
        to_int(row['录取人数3']),
        to_int(row['最低分3']),
        to_int(row['最低位次3']),
        to_int(row['平均分3']),
        to_int(row['平均位次3']),
        to_int(row['最高分3']),
        to_int(row['最高位次3']),
        to_int(row['计划人数3']),
        to_str(row['老批次3']),
        to_str(row['所在省']),
        to_str(row['城市']),
        to_str(row['城市水平标签']),
    )

def main():
    print("读取Excel文件...")
    df = pd.read_excel(EXCEL_FILE, sheet_name='Sheet1', dtype=str)
    num_cols = [
        '年份','院校代码','院校专业组代码','学制','专业组计划人数',
        '专业组录取人数1','专业组最低分1','专业组最低位次1',
        '录取人数1','最低分1','最低位次1','平均分1','平均位次1','最高分1','最高位次1','计划人数1',
        '录取人数2','最低分2','最低位次2','平均分2','平均位次2','最高分2','最高位次2','计划人数2',
        '录取人数3','最低分3','最低位次3','平均分3','平均位次3','最高分3','最高位次3','计划人数3',
    ]
    for col in num_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')

    total = len(df)
    print(f"共 {total} 条记录")

    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()

    print("清空 admission_plan 表...")
    cursor.execute("TRUNCATE TABLE admission_plan")
    conn.commit()
    print("清空完成，开始导入...")

    BATCH = 500
    success = 0
    errors = 0

    for i in range(0, total, BATCH):
        chunk = df.iloc[i:i+BATCH]
        rows = [row_to_tuple(i + j + 1, row) for j, (_, row) in enumerate(chunk.iterrows())]
        try:
            cursor.executemany(INSERT_SQL, rows)
            conn.commit()
            success += len(rows)
        except Exception as e:
            conn.rollback()
            errors += len(rows)
            print(f"\n  [错误] 批次 {i}~{i+BATCH}: {e}")

        pct = min(100, (i + BATCH) * 100 // total)
        print(f"\r  进度: {pct}%  成功:{success}  失败:{errors}", end='', flush=True)

    print(f"\n\n导入完成！成功 {success} 条，失败 {errors} 条。")
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
