const mysql = require('mysql2/promise');
const xlsx = require('xlsx');
const path = require('path');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'cm1990131',
    database: 'gaokao',
    charset: 'utf8mb4'
};

async function importGuangdong() {
    const pool = await mysql.createPool(dbConfig);

    try {
        // 读取 Excel
        const filePath = path.join(__dirname, '..', 'guangdong.xlsx');
        const workbook = xlsx.readFile(filePath);
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(ws, { defval: null });

        console.log(`读取到 ${rows.length} 行数据`);
        console.log('列名:', Object.keys(rows[0]));

        // 建表（与 henan 结构相同）
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS guangdong (
                admit_year    INT,
                school_name   VARCHAR(255),
                school_code   INT,
                batch         VARCHAR(255),
                subject_type  VARCHAR(255),
                major_name    VARCHAR(255),
                major_code    VARCHAR(255),
                major_group   VARCHAR(255),
                major_remark  TEXT,
                subject_require VARCHAR(255),
                admit_num     INT,
                min_score     INT,
                min_rank      INT,
                province      VARCHAR(255),
                school_type   VARCHAR(255)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('guangdong 表已就绪');

        // 清空旧数据
        await pool.execute('TRUNCATE TABLE guangdong');
        console.log('旧数据已清空');

        // 批量插入（每批 500 条）
        const batchSize = 500;
        let inserted = 0;

        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const values = batch.map(r => [
                r.admit_year   ?? null,
                r.school_name  ?? null,
                r.school_code  ?? null,
                r.batch        ?? null,
                r.subject_type ?? null,
                r.major_name   ?? null,
                r.major_code   != null ? String(r.major_code) : null,
                r.major_group  != null ? String(r.major_group) : null,
                r.major_remark ?? null,
                r.subject_require ?? null,
                r.admit_num    ?? null,
                r.min_score    ?? null,
                r.min_rank     ?? null,
                r.province     ?? null,
                r.school_type  ?? null
            ]);

            const placeholders = values.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
            const flat = values.flat();
            await pool.execute(
                `INSERT INTO guangdong (admit_year,school_name,school_code,batch,subject_type,major_name,major_code,major_group,major_remark,subject_require,admit_num,min_score,min_rank,province,school_type) VALUES ${placeholders}`,
                flat
            );
            inserted += batch.length;
            process.stdout.write(`\r已导入 ${inserted}/${rows.length} 条`);
        }

        console.log(`\n✅ 导入完成，共 ${inserted} 条记录`);

        // 验证
        const [count] = await pool.execute('SELECT COUNT(*) as cnt FROM guangdong');
        console.log(`数据库实际记录数：${count[0].cnt}`);

        // 显示几条样本
        const [samples] = await pool.execute('SELECT school_name,major_name,subject_type,subject_require,min_score FROM guangdong LIMIT 3');
        console.log('样本数据：');
        samples.forEach(r => console.log(JSON.stringify(r)));

    } catch (err) {
        console.error('导入失败:', err.message);
    } finally {
        await pool.end();
    }
}

importGuangdong();
