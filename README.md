# 高考志愿智能推荐系统

## 📊 系统配置（方案A）

- **数据库名**: gaokao
- **院校数据表**: admission（你的数据，用于推荐）
- **用户记录表**: user_recommendations（系统使用，保存推荐记录）
- **用户名**: root
- **密码**: cm1990131
- **端口**: 3000

---

## 📋 数据表说明

### admission 表（你的院校数据）
**作用**: 存储院校录取数据，用于智能推荐

**关键字段**:
- school_name - 学校名称
- major_name - 专业名称
- min_score - 最低录取分数
- min_rank - 最低录取位次
- batch - 批次（本科批/专科批）
- subject_type - 科类（理工/文史）
- province - 省份

### user_recommendations 表（系统生成）
**作用**: 存储用户的推荐记录

**关键字段**:
- region - 用户所在地区
- score - 用户高考分数
- subjectCombination - 选科组合
- recommendations - 推荐结果（JSON格式）
- saveTime - 保存时间

---

## 🚀 一键启动

### 步骤1：初始化数据库

**双击运行**：`backend/init-db.bat`

**功能**: 
- ✅ 检查MySQL服务
- ✅ 验证数据库 `gaokao` 存在
- ✅ 创建数据表 `user_recommendations`
- ✅ 验证 `admission` 表存在（你的院校数据）
- ✅ 显示院校数据记录数

---

### 步骤2：启动后端服务

**双击运行**：`backend/start-server.bat`

**功能**:
- ✅ 安装依赖（express, mysql2, cors）
- ✅ 检查MySQL连接
- ✅ 验证数据库和表
- ✅ 启动Node.js服务器

**启动成功后会显示**:
```
✅ MySQL数据库连接成功！

🚀 后端服务器启动成功！
📡 API地址: http://localhost:3000/api
🌐 前端页面: http://localhost:3000/index-mysql.html

📋 可用的API接口:
   GET    /api/recommendations       - 获取用户推荐记录
   POST   /api/recommend-from-db     - 从admission表获取推荐（新）
   POST   /api/recommendations       - 保存推荐记录
   DELETE /api/recommendations/:id   - 删除记录
   DELETE /api/recommendations       - 清空所有记录
   GET    /api/test-connection       - 测试数据库连接

📊 数据库说明:
   - admission表: 存储院校录取数据（用于推荐）
   - user_recommendations表: 存储用户推荐记录（保存历史）
```

---

### 步骤3：访问系统

**浏览器打开**：
```
http://localhost:3000/index-mysql.html
```

**验证成功**:
- 右上角显示 🟢 **已连接到后端**
- 页面正常显示，无报错

---

## 📁 项目文件

```
e:\xm\
│
├── backend/                      # 后端目录
│   ├── init-db.bat              # 1. 初始化数据库
│   ├── start-server.bat         # 2. 启动服务
│   ├── server.js                # 后端程序
│   └── database.sql             # 数据库结构
│
├── index-mysql.html             # 主页面
├── api-service.js              # API服务
├── 部署说明-快速版.md          # 详细说明
└── README.md                   # 本文档
```

---

## 🎯 核心功能

### ✅ 已实现功能

1. **表单填写**
   - 地区选择、分数输入、选科组合
   - 批次选择、地区偏好、专业意向
   - 毕业规划、性格类型、其他要求

2. **智能推荐**
   - 基于选科匹配院校
   - 冲/稳/保分类推荐
   - 录取概率计算

3. **数据持久化**
   - 保存到MySQL数据库
   - 历史记录管理
   - 数据导出（JSON）

4. **历史管理**
   - 查看历史记录
   - 恢复历史详情
   - 删除单条记录
   - 清空所有记录

---

## 🔧 手动配置（如需修改）

### 修改数据库名或表名

1. **修改后端配置** - `backend/server.js`:
```javascript
// 第11-17行
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'cm1990131',
  database: 'gaokao'      // 数据库名
};

// 将所有SQL中的 admission 改为新表名
// 例如：'SELECT * FROM admission' → 'SELECT * FROM 新表名'
```

2. **修改SQL文件** - `backend/database.sql`:
```sql
-- 第3行
CREATE DATABASE IF NOT EXISTS gaokao;

-- 第7行
CREATE TABLE IF NOT EXISTS admission (    -- 表名
```

3. **修改批处理脚本**:
   - `backend/init-db.bat` - 更新所有SQL语句
   - `backend/start-server.bat` - 更新验证信息

---

## 🐛 常见问题

### ❌ MySQL未启动
**解决**: 
1. Win+R → services.msc
2. 启动 MySQL 服务

### ❌ 数据库不存在
**解决**: 
先运行 `backend/init-db.bat`

### ❌ 端口被占用
**解决**: 
1. 编辑 `backend/server.js`
2. 修改第7行: `const PORT = 3001;`
3. 访问: `http://localhost:3001/index-mysql.html`

### ❌ npm安装失败
**解决**: 
以管理员身份运行命令提示符，然后:
```bash
cd e:\xm\backend
npm install express mysql2 cors
```

---

## ✅ 验证部署

1. **后端启动**: 显示"后端服务器启动成功"
2. **数据库连接**: 显示"MySQL数据库连接成功"
3. **前端访问**: 右上角显示"已连接到后端"
4. **功能测试**: 
   - 填写表单 → 开始推荐
   - 保存记录 → 查看历史
   - 刷新页面 → 数据仍在

---

## 📞 技术支持

- **详细部署说明**: `部署说明-快速版.md`
- **完整测试指南**: `backend/测试说明.md`
- **项目总结**: `项目完成总结.md`

---

## 🎉 开始使用

部署成功后，你可以：

1. **填写志愿信息**: 地区、分数、选科等
2. **获取智能推荐**: 点击"开始推荐"
3. **保存记录**: 点击"保存记录"
4. **管理历史**: 查看、删除历史记录
5. **导出数据**: 导出JSON文件

---

**祝你金榜题名，考上理想大学！** 🎓✨

---

*项目完成时间：2026年3月22日*
*数据库配置：gaokao/admission*
