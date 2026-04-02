-- 大明白高报数据表：河南省2022~2024历史录取数据+2025招生计划
-- 创建于2026-03-27

USE gaokao;

CREATE TABLE IF NOT EXISTS `henan_admission_plan` (
  `id`                    INT             NOT NULL COMMENT '数据ID',
  `year`                  SMALLINT        NOT NULL COMMENT '年份（2025=计划，2024/2023/2022=历史）',
  `source_province`       VARCHAR(10)     NOT NULL COMMENT '生源地',
  `batch`                 VARCHAR(20)     NOT NULL COMMENT '批次',
  `subject_type`          VARCHAR(10)     NOT NULL COMMENT '科类（历史/物理）',
  `batch_remark`          VARCHAR(50)         NULL COMMENT '批次备注',
  `college_code`          INT             NOT NULL COMMENT '院校代码',
  `college_name`          VARCHAR(100)    NOT NULL COMMENT '院校名称',
  `college_major_group_code` INT          NOT NULL COMMENT '院校专业组代码',
  `major_group_code`      VARCHAR(20)         NULL COMMENT '专业组代码',
  `major_group_name`      VARCHAR(100)    NOT NULL COMMENT '专业组名称',
  `major_code`            VARCHAR(20)     NOT NULL COMMENT '专业代码',
  `major_full_name`       VARCHAR(200)    NOT NULL COMMENT '专业全称',
  `major_name`            VARCHAR(200)    NOT NULL COMMENT '专业名称',
  `major_remark`          TEXT                NULL COMMENT '专业备注',
  `subject_require`       VARCHAR(50)     NOT NULL COMMENT '选科要求',
  `major_level`           VARCHAR(20)     NOT NULL COMMENT '专业层次（本科/专科）',
  `school_years`          TINYINT             NULL COMMENT '学制（年）',
  `tuition`               VARCHAR(50)         NULL COMMENT '学费（元/年）',
  `group_majors`          TEXT                NULL COMMENT '组内专业（汇总文本）',
  `group_plan_count`      SMALLINT            NULL COMMENT '专业组计划人数',
  `category`              VARCHAR(50)         NULL COMMENT '门类',
  `major_category`        VARCHAR(100)        NULL COMMENT '专业类',
  `major_sector`          VARCHAR(100)        NULL COMMENT '专业版块',
  `group_position`        VARCHAR(100)        NULL COMMENT '专业组定位',
  `recruit_history`       VARCHAR(50)         NULL COMMENT '历年招生数量（如1-1-1）',
  `recommend_reason`      VARCHAR(500)        NULL COMMENT '选择原因',

  -- 2024年专业组数据
  `group_admit_count_1`   SMALLINT            NULL COMMENT '2024专业组录取人数',
  `group_min_score_1`     SMALLINT            NULL COMMENT '2024专业组最低分',
  `group_min_rank_1`      INT                 NULL COMMENT '2024专业组最低位次',

  -- 2024年专业录取数据
  `admit_count_1`         SMALLINT            NULL COMMENT '2024录取人数',
  `min_score_1`           SMALLINT            NULL COMMENT '2024最低分',
  `min_rank_1`            INT                 NULL COMMENT '2024最低位次',
  `avg_score_1`           SMALLINT            NULL COMMENT '2024平均分',
  `avg_rank_1`            INT                 NULL COMMENT '2024平均位次',
  `max_score_1`           SMALLINT            NULL COMMENT '2024最高分',
  `max_rank_1`            INT                 NULL COMMENT '2024最高位次',
  `plan_count_1`          SMALLINT            NULL COMMENT '2024计划人数',
  `old_batch_1`           VARCHAR(30)         NULL COMMENT '2024老批次',
  `admit_verified`        VARCHAR(20)         NULL COMMENT '录取测试（录取/未录取）',

  -- 2023年专业录取数据
  `admit_count_2`         SMALLINT            NULL COMMENT '2023录取人数',
  `min_score_2`           SMALLINT            NULL COMMENT '2023最低分',
  `min_rank_2`            INT                 NULL COMMENT '2023最低位次',
  `avg_score_2`           SMALLINT            NULL COMMENT '2023平均分',
  `avg_rank_2`            INT                 NULL COMMENT '2023平均位次',
  `max_score_2`           SMALLINT            NULL COMMENT '2023最高分',
  `max_rank_2`            INT                 NULL COMMENT '2023最高位次',
  `plan_count_2`          SMALLINT            NULL COMMENT '2023计划人数',
  `old_batch_2`           VARCHAR(30)         NULL COMMENT '2023老批次',

  -- 2022年专业录取数据
  `admit_count_3`         SMALLINT            NULL COMMENT '2022录取人数',
  `min_score_3`           SMALLINT            NULL COMMENT '2022最低分',
  `min_rank_3`            INT                 NULL COMMENT '2022最低位次',
  `avg_score_3`           SMALLINT            NULL COMMENT '2022平均分',
  `avg_rank_3`            INT                 NULL COMMENT '2022平均位次',
  `max_score_3`           SMALLINT            NULL COMMENT '2022最高分',
  `max_rank_3`            INT                 NULL COMMENT '2022最高位次',
  `plan_count_3`          SMALLINT            NULL COMMENT '2022计划人数',
  `old_batch_3`           VARCHAR(30)         NULL COMMENT '2022老批次',

  -- 院校基础信息
  `college_province`      VARCHAR(20)         NULL COMMENT '院校所在省',
  `college_city`          VARCHAR(50)         NULL COMMENT '院校城市',
  `city_level`            VARCHAR(20)         NULL COMMENT '城市水平标签（一线/新一线等）',

  PRIMARY KEY (`id`),
  INDEX `idx_college_name`   (`college_name`),
  INDEX `idx_college_code`   (`college_code`),
  INDEX `idx_subject_type`   (`subject_type`),
  INDEX `idx_subject_require`(`subject_require`),
  INDEX `idx_min_score_1`    (`min_score_1`),
  INDEX `idx_major_name`     (`major_name`(50)),
  INDEX `idx_major_group`    (`college_major_group_code`),
  INDEX `idx_college_city`   (`college_province`, `college_city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='大明白高报数据：河南省2022~2024历史录取+2025招生计划';
