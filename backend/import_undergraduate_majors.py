# -*- coding: utf-8 -*-
"""
导入本科专业数据到 major_category 表
"""

import mysql.connector
from mysql.connector import Error
import sys
import os

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from undergraduate_majors_data import UNDERGRADUATE_DATA

db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'cm1990131',
    'database': 'gaokao',
    'charset': 'utf8mb4'
}

def import_undergraduate_majors():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # 清空表
        cursor.execute("DELETE FROM major_category")
        conn.commit()
        print("[OK] 已清空表")
        
        # 插入本科层级 (level=1)
        cursor.execute("""
            INSERT INTO major_category (code, name, level, parent_id, status)
            VALUES ('00', '本科', 1, NULL, 1)
        """)
        undergraduate_id = cursor.lastrowid
        print("[OK] 插入本科层级")
        
        total_count = 1
        category_count = 0
        class_count = 0
        major_count = 0
        
        # 遍历学科门类
        for cat_code, cat_data in UNDERGRADUATE_DATA.items():
            cat_name = cat_data["name"]
            
            # 插入门类 (level=2)
            cursor.execute("""
                INSERT INTO major_category (code, name, level, parent_id, category_code, category_name, status)
                VALUES (%s, %s, 2, %s, %s, %s, 1)
            """, (cat_code, cat_name, undergraduate_id, cat_code, cat_name))
            cat_db_id = cursor.lastrowid
            category_count += 1
            
            # 遍历专业类
            for class_code, class_data in cat_data["classes"].items():
                class_name = class_data["name"]
                
                # 插入专业类 (level=3)
                cursor.execute("""
                    INSERT INTO major_category (code, name, level, parent_id, category_code, category_name, class_code, class_name, status)
                    VALUES (%s, %s, 3, %s, %s, %s, %s, %s, 1)
                """, (class_code, class_name, cat_db_id, cat_code, cat_name, class_code, class_name))
                class_db_id = cursor.lastrowid
                class_count += 1
                
                # 遍历专业
                for major_code, major_name in class_data["majors"]:
                    # 插入专业 (level=4)
                    cursor.execute("""
                        INSERT INTO major_category (code, name, level, parent_id, category_code, category_name, class_code, class_name, status)
                        VALUES (%s, %s, 4, %s, %s, %s, %s, %s, 1)
                    """, (major_code, major_name, class_db_id, cat_code, cat_name, class_code, class_name))
                    major_count += 1
        
        conn.commit()
        
        total_count = 1 + category_count + class_count + major_count
        print(f"[OK] 导入完成:")
        print(f"  - 本科层级: 1")
        print(f"  - 学科门类: {category_count}")
        print(f"  - 专业类: {class_count}")
        print(f"  - 专业: {major_count}")
        print(f"  - 总计: {total_count} 条")
        
        cursor.close()
        conn.close()
        
    except Error as e:
        print(f"[ERROR] {e}")
        raise

if __name__ == '__main__':
    import_undergraduate_majors()
