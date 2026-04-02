import pandas as pd
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')
df = pd.read_excel('../大学基本信息.xlsx')
# 处理NaN值，转换为None
df = df.where(pd.notnull(df), None)
# 转换为JSON字符串
json_data = df.to_json(orient='records', force_ascii=False, default_handler=str)
print(json_data)
