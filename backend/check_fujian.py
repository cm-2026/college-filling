import pandas as pd

df = pd.read_excel(r'C:/Users/Administrator/Desktop/福建数据.xlsx', nrows=3)
print(f"列数: {len(df.columns)}")
print(f"行数（含标题）: {len(df)+1}")
print("\n列名列表:")
for i, col in enumerate(df.columns):
    print(f"  {i+1:>3}. {col}")
print("\n前2行数据:")
print(df.head(2).to_string())
