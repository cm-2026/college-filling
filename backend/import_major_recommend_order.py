# -*- coding: utf-8 -*-
"""
清空 major_recommend_order 表并从 Excel 导入新数据
"""
import pandas as pd
import pymysql

# 数据库配置
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'cm1990131',
    'database': 'gaokao',
    'charset': 'utf8mb4'
}

# Excel 文件路径
excel_file = 'C:/Users/Administrator/Desktop/2025本科专业推荐顺序(3).xlsx'

def main():
    # 读取 Excel
    df = pd.read_excel(excel_file)
    print(f'读取到 {len(df)} 条数据')
    print(df.head(10))
    
    # 连接数据库
    conn = pymysql.connect(**db_config)
    cursor = conn.cursor()
    
    try:
        # 清空表
        cursor.execute('DELETE FROM major_recommend_order')
        print('已清空 major_recommend_order 表')
        
        # 重置自增ID
        cursor.execute('ALTER TABLE major_recommend_order AUTO_INCREMENT = 1')
        
        # 批量插入
        insert_sql = '''
            INSERT INTO major_recommend_order (discipline_category, major_category, sort_order)
            VALUES (%s, %s, %s)
        '''
        
        data = []
        for _, row in df.iterrows():
            category = str(row['学科门类']).strip() if pd.notna(row['学科门类']) else ''
            major_category = str(row['专业类']).strip() if pd.notna(row['专业类']) else ''
            sort_order = int(row['排序编号']) if pd.notna(row['排序编号']) else 0
            data.append((category, major_category, sort_order))
        
        cursor.executemany(insert_sql, data)
        conn.commit()
        print(f'成功导入 {cursor.rowcount} 条数据')
        
        # 验证
        cursor.execute('SELECT COUNT(*) FROM major_recommend_order')
        count = cursor.fetchone()[0]
        print(f'表中现有 {count} 条记录')
        
        # 显示前10条
        cursor.execute('SELECT id, discipline_category, major_category, sort_order FROM major_recommend_order ORDER BY sort_order LIMIT 10')
        print('\n前10条数据:')
        for row in cursor.fetchall():
            print(f'  {row}')
            
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    main()
