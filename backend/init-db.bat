@echo off
echo ========================================
echo 高考志愿智能推荐系统 - 数据库初始化
echo ========================================
echo.

REM 检查MySQL服务状态
echo 正在检查MySQL服务...
sc query MySQL80 | findstr "STATE" | findstr "RUNNING" >nul
if %errorlevel% neq 0 (
    sc query MySQL | findstr "STATE" | findstr "RUNNING" >nul
    if %errorlevel% neq 0 (
        echo ❌ MySQL服务未启动！
        echo.
        echo 请按以下步骤启动MySQL服务：
        echo 1. 按 Win+R 键，输入 services.msc
        echo 2. 找到 MySQL 或 MySQL80 服务
        echo 3. 右键点击"启动"
        echo.
        pause
        exit /b 1
    ) else (
        echo ✅ MySQL服务正在运行
    )
) else (
    echo ✅ MySQL80服务正在运行
)

echo.

REM 检查数据库是否存在
echo 正在检查数据库 gaokao...
mysql -u root -pcm1990131 -e "SHOW DATABASES LIKE 'gaokao';" | findstr "gaokao" >nul
if %errorlevel% neq 0 (
    echo 📦 数据库 gaokao 不存在，正在创建...
    mysql -u root -pcm1990131 -e "CREATE DATABASE IF NOT EXISTS gaokao CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    if %errorlevel% neq 0 (
        echo ❌ 数据库创建失败！
        echo.
        pause
        exit /b 1
    )
    echo ✅ 数据库 gaokao 创建成功！
) else (
    echo ✅ 数据库 gaokao 已存在
)

echo.

REM 检查并创建 user_recommendations 表
echo 正在检查数据表 user_recommendations...
mysql -u root -pcm1990131 gaokao -e "SHOW TABLES LIKE 'user_recommendations';" | findstr "user_recommendations" >nul
if %errorlevel% neq 0 (
    echo 📦 数据表 user_recommendations 不存在，正在创建...
    mysql -u root -pcm1990131 gaokao < database.sql
    if %errorlevel% neq 0 (
        echo ❌ 数据表创建失败！
        echo.
        pause
        exit /b 1
    )
    echo ✅ 数据表 user_recommendations 创建成功！
) else (
    echo ⚠️  数据表 user_recommendations 已存在，检查是否需要更新结构...
    
    REM 检查是否存在 batch 字段（旧结构）
    mysql -u root -pcm1990131 gaokao -e "SHOW COLUMNS FROM user_recommendations LIKE 'batch';" | findstr "batch" >nul
    if %errorlevel% equ 0 (
        echo 🔄 发现旧表结构，正在删除并重建数据表...
        mysql -u root -pcm1990131 gaokao -e "DROP TABLE user_recommendations;"
        mysql -u root -pcm1990131 gaokao < database.sql
        if %errorlevel% neq 0 (
            echo ❌ 数据表重建失败！
            echo.
            pause
            exit /b 1
        )
        echo ✅ 数据表 user_recommendations 重建成功！
    ) else (
        echo ✅ 数据表 user_recommendations 结构正确
    )
)

echo.

REM 检查admission表是否存在
echo 正在检查院校数据表 admission...
mysql -u root -pcm1990131 gaokao -e "SHOW TABLES LIKE 'admission';" | findstr "admission" >nul
if %errorlevel% neq 0 (
    echo ⚠️  警告：院校数据表 admission 不存在！
    echo.
    echo 请确保admission表已创建，包含院校录取数据。
    echo 否则推荐功能将无法使用真实数据。
    echo.
    echo 表结构应包含：
    echo - school_name, school_code, major_name, major_code
    echo - batch, subject_type, min_score, min_rank
    echo - province, admit_year 等字段
    echo.
    pause
) else (
    echo ✅ 院校数据表 admission 已存在
    
    REM 检查admission表是否有数据
    for /f "tokens=*" %%i in ('mysql -u root -pcm1990131 gaokao -e "SELECT COUNT(*) FROM admission;" --skip-column-names') do set count=%%i
    echo 📊 院校数据记录数: !count!
    if "!count!"=="0" (
        echo ⚠️  警告：admission表中没有数据！
        echo.
        echo 请导入院校录取数据，否则推荐功能将无法使用。
        echo.
    )
)

echo.
echo ========================================
echo ✅ 数据库初始化完成！
echo ========================================
echo.
echo 配置信息：
echo - 数据库: gaokao
echo - 院校数据表: admission (你的数据)
echo - 用户记录表: user_recommendations (系统使用)
echo - 用户名: root
echo - 密码: cm1990131
echo.
echo 说明：
echo - admission表：存储院校录取数据（推荐时使用）
echo - user_recommendations表：存储用户推荐记录（保存时使用）
echo.
echo 下一步：
echo 双击运行 start-server.bat 启动后端服务
echo.
pause
