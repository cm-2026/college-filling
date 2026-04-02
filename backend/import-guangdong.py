import openpyxl
import pymysql
import sys
import os

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'cm1990131',
    'database': 'gaokao',
    'charset': 'utf8mb4'
}

XLSX_PATH = os.path.join(os.path.dirname(__file__), '..', 'guangdong.xlsx')

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS guangdong (
    admit_year      INT,
    school_name     VARCHAR(255),
    school_code     INT,
    batch           VARCHAR(255),
    subject_type    VARCHAR(255),
    major_name      VARCHAR(255),
    major_code      VARCHAR(255),
    major_group     VARCHAR(255),
    major_remark    TEXT,
    subject_require VARCHAR(255),
    admit_num       INT,
    min_score       INT,
    min_rank        INT,
    province        VARCHAR(255),
    school_type     VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
"""

INSERT_SQL = """
INSERT INTO guangdong
(admit_year,school_name,school_code,batch,subject_type,major_name,
 major_code,major_group,major_remark,subject_require,admit_num,
 min_score,min_rank,province,school_type)
VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
"""

def to_int(v):
    if v is None: return None
    try: return int(v)
    except: return None

def to_str(v):
    if v is None: return None
    return str(v).strip() if str(v).strip() != '' else None

def main():
    print(f"读取文件: {XLSX_PATH}")
    wb = openpyxl.load_workbook(XLSX_PATH, read_only=True, data_only=True)
    ws = wb.active

    rows_iter = ws.iter_rows(values_only=True)
    header = next(rows_iter)
    print(f"列名: {header}")

    # 列名映射到索引
    col = {name: i for i, name in enumerate(header)}

    all_rows = list(rows_iter)
    print(f"共 {len(all_rows)} 行数据")
    wb.close()

    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()

    # 建表
    cursor.execute(CREATE_TABLE_SQL)
    print("guangdong 表已就绪")

    # 清空旧数据
    cursor.execute("TRUNCATE TABLE guangdong")
    conn.commit()
    print("旧数据已清空")

    # 批量插入
    batch_size = 500
    inserted = 0
    batch = []

    for row in all_rows:
        record = (
            to_int(row[col['admit_year']]),
            to_str(row[col['school_name']]),
            to_int(row[col['school_code']]),
            to_str(row[col['batch']]),
            to_str(row[col['subject_type']]),
            to_str(row[col['major_name']]),
            to_str(row[col['major_code']]),
            to_str(row[col['major_group']]),
            to_str(row[col['major_remark']]),
            to_str(row[col['subject_require']]),
            to_int(row[col['admit_num']]),
            to_int(row[col['min_score']]),
            to_int(row[col['min_rank']]),
            to_str(row[col['province']]),
            to_str(row[col['school_type']]),
        )
        batch.append(record)

        if len(batch) >= batch_size:
            cursor.executemany(INSERT_SQL, batch)
            conn.commit()
            inserted += len(batch)
            print(f"\r已导入 {inserted}/{len(all_rows)} 条", end='', flush=True)
            batch = []

    if batch:
        cursor.executemany(INSERT_SQL, batch)
        conn.commit()
        inserted += len(batch)

    print(f"\n✅ 导入完成，共 {inserted} 条记录")

    # 验证
    cursor.execute("SELECT COUNT(*) FROM guangdong")
    count = cursor.fetchone()[0]
    print(f"数据库实际记录数: {count}")

    cursor.execute("SELECT school_name,major_name,subject_type,subject_require,min_score FROM guangdong LIMIT 3")
    print("样本数据:")
    for r in cursor.fetchall():
        print(r)

    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
