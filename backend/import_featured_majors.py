# -*- coding: utf-8 -*-
"""
导入特色专业数据到数据库
"""

import pandas as pd
import mysql.connector
from mysql.connector import Error

# 数据库连接配置
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'cm1990131',
    'database': 'gaokao',
    'charset': 'utf8mb4'
}

# 创建表SQL
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS featured_majors (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    feature_type VARCHAR(50) NOT NULL COMMENT '特色类型',
    majors JSON COMMENT '优势专业列表(JSON数组)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_feature_type (feature_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='特色专业表';
"""

def main():
    print("=" * 50)
    print("特色专业数据导入工具")
    print("=" * 50)
    
    # 读取Excel
    print("\n[1] 读取Excel文件...")
    df = pd.read_excel('C:/Users/Administrator/Desktop/特色专业.xlsx')
    print(f"    共 {len(df)} 行数据")
    
    # 连接数据库
    print("\n[2] 连接数据库...")
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    
    try:
        # 创建表
        print("\n[3] 创建表...")
        cursor.execute(CREATE_TABLE_SQL)
        print("    OK 表 featured_majors 已创建")
        
        # 清空旧数据
        cursor.execute("DELETE FROM featured_majors")
        print("    OK 已清空旧数据")
        
        # 准备插入数据
        insert_sql = """
            INSERT INTO featured_majors (feature_type, majors)
            VALUES (%s, %s)
        """
        
        inserted = 0
        for _, row in df.iterrows():
            feature_type = row['特色类型']
            
            # 收集所有非空专业
            majors = []
            for i in range(1, 14):
                col = f'专业{i}'
                if col in row and pd.notna(row[col]):
                    majors.append(str(row[col]))
            
            # 转换为JSON
            import json
            majors_json = json.dumps(majors, ensure_ascii=False)
            
            cursor.execute(insert_sql, (feature_type, majors_json))
            inserted += 1
            print(f"    OK {feature_type}: {len(majors)}个专业")
        
        conn.commit()
        print(f"\n[OK] 导入完成！共 {inserted} 条记录")
        
        # 验证数据
        print("\n[4] 验证数据...")
        cursor.execute("SELECT COUNT(*) FROM featured_majors")
        count = cursor.fetchone()[0]
        print(f"    表中共 {count} 条记录")
        
        # 显示示例
        print("\n[5] 示例数据:")
        cursor.execute("SELECT feature_type, majors FROM featured_majors LIMIT 3")
        for row in cursor.fetchall():
            print(f"    {row[0]}: {row[1]}")
        
    except Error as e:
        print(f"\n[ERROR] 错误: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()
        print("\n[OK] 数据库连接已关闭")

if __name__ == '__main__':
    main()
