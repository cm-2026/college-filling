#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
获取 admission_plan 表结构
"""

import mysql.connector

db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'cm1990131',
    'database': 'gaokao',
    'charset': 'utf8mb4'
}

try:
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    
    cursor.execute("DESCRIBE admission_plan")
    columns = cursor.fetchall()
    
    print("admission_plan 表结构：")
    print("-" * 80)
    for col in columns:
        print(f"{col[0]:30} {col[1]:20} {col[2]:5} {col[3]:10}")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"ERROR: {e}")
