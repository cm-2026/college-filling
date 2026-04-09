# -*- coding: utf-8 -*-
"""
导入专业基本介绍数据到数据库
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
CREATE TABLE IF NOT EXISTS major_introduction (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    subject_category VARCHAR(50) COMMENT '学科门类',
    major_class VARCHAR(50) COMMENT '专业类',
    level VARCHAR(20) COMMENT '层次',
    major_name VARCHAR(100) COMMENT '专业名称',
    major_code VARCHAR(20) COMMENT '专业代码',
    study_years VARCHAR(20) COMMENT '修业年限',
    degree VARCHAR(50) COMMENT '授予学位',
    gender_ratio VARCHAR(100) COMMENT '性别比例',
    major_intro TEXT COMMENT '专业是什么',
    major_content TEXT COMMENT '专业学什么',
    career_direction TEXT COMMENT '专业干什么',
    employment_destination TEXT COMMENT '就业去向',
    employment_region TEXT COMMENT '就业地区分布',
    employment_industry TEXT COMMENT '就业行业分布',
    employment_position TEXT COMMENT '就业岗位分布',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_major_name (major_name),
    INDEX idx_major_code (major_code),
    INDEX idx_subject_category (subject_category),
    INDEX idx_major_class (major_class)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='专业基本介绍表';
"""

def process_employment_data(df, row_idx, start_col, end_col):
    """处理就业地区/行业分布数据（多列合并）"""
    values = []
    for i in range(start_col, end_col + 1):
        val = df.iloc[row_idx, i]
        if pd.notna(val) and str(val).strip():
            values.append(str(val).strip())
    return '；'.join(values) if values else None

def import_major_intro():
    try:
        # 读取Excel文件
        print("正在读取Excel文件...")
        df = pd.read_excel('C:/Users/Administrator/Desktop/专业基本介绍.xlsx')
        print(f"读取完成，共 {len(df)} 行数据")
        
        # 连接数据库
        print("正在连接数据库...")
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # 创建表
        print("正在创建表...")
        cursor.execute("DROP TABLE IF EXISTS major_introduction")
        cursor.execute(CREATE_TABLE_SQL)
        print("表创建成功")
        
        # 准备插入语句
        insert_sql = """
        INSERT INTO major_introduction 
        (subject_category, major_class, level, major_name, major_code, study_years, 
         degree, gender_ratio, major_intro, major_content, career_direction, 
         employment_destination, employment_region, employment_industry, employment_position)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        # 处理每一行数据
        print("正在导入数据...")
        success_count = 0
        error_count = 0
        
        for idx in range(len(df)):
            try:
                row = df.iloc[idx]
                
                # 基本字段
                subject_category = row['学科门类'] if pd.notna(row['学科门类']) else None
                major_class = row['专业类'] if pd.notna(row['专业类']) else None
                level = row['层次'] if pd.notna(row['层次']) else None
                major_name = row['专业名称'] if pd.notna(row['专业名称']) else None
                major_code = str(row['专业代码']) if pd.notna(row['专业代码']) else None
                study_years = row['修业年限'] if pd.notna(row['修业年限']) else None
                degree = row['授予学位'] if pd.notna(row['授予学位']) else None
                gender_ratio = row['性别比例'] if pd.notna(row['性别比例']) else None
                major_intro = row['专业是什么'] if pd.notna(row['专业是什么']) else None
                major_content = row['专业学什么'] if pd.notna(row['专业学什么']) else None
                career_direction = row['专业干什么'] if pd.notna(row['专业干什么']) else None
                employment_destination = row['就业去向'] if pd.notna(row['就业去向']) else None
                
                # 就业地区分布（列14-29，即索引14到29）
                employment_region = process_employment_data(df, idx, 14, 29)
                
                # 就业行业分布（列30-40，即索引30到40）
                employment_industry = process_employment_data(df, idx, 30, 40)
                
                # 就业岗位分布（列41，即索引41）
                employment_position = row['就业岗位分布'] if pd.notna(row['就业岗位分布']) else None
                
                # 插入数据
                cursor.execute(insert_sql, (
                    subject_category, major_class, level, major_name, major_code,
                    study_years, degree, gender_ratio, major_intro, major_content,
                    career_direction, employment_destination, employment_region,
                    employment_industry, employment_position
                ))
                success_count += 1
                
                if (idx + 1) % 100 == 0:
                    print(f"已处理 {idx + 1}/{len(df)} 行...")
                    
            except Exception as e:
                print(f"第 {idx + 1} 行导入失败: {e}")
                error_count += 1
                continue
        
        # 提交事务
        conn.commit()
        print(f"\n导入完成！")
        print(f"成功: {success_count} 行")
        print(f"失败: {error_count} 行")
        
        # 验证数据
        cursor.execute("SELECT COUNT(*) FROM major_introduction")
        count = cursor.fetchone()[0]
        print(f"数据库中共有 {count} 条记录")
        
        # 显示前3条数据
        print("\n前3条数据预览：")
        cursor.execute("SELECT id, major_name, major_code, subject_category, major_class FROM major_introduction LIMIT 3")
        for row in cursor.fetchall():
            print(row)
        
        cursor.close()
        conn.close()
        print("\n数据库连接已关闭")
        
    except Error as e:
        print(f"数据库错误: {e}")
    except Exception as e:
        print(f"错误: {e}")

if __name__ == '__main__':
    import_major_intro()
