-- ============================================================================
-- 亏了 · 正式上线版 数据库 Schema
-- ----------------------------------------------------------------------------
-- 目标数据库： MySQL 8.0（字符集 utf8mb4，排序规则 utf8mb4_0900_ai_ci）
-- 引擎：     InnoDB（支持事务与外键）
--
-- 【小白须知】怎么用这个文件
--   1. 它是纯文本的建表说明，用「结构化查询语言」（SQL）描述数据怎么存。
--   2. 不用手敲！部署脚本会自动把它整份执行一遍。
--   3. 表名前缀含义：
--        user_   / flag_  / checkin_   业务主表
--        ai_     模型判定留痕
--        pay_    支付与押金
--        _log    只追加不修改的历史流水（结算依据）
--
-- 【命名约定】
--   · 主键统一 id（VARCHAR(32)），用业务可读前缀：usr_ / flg_ / cki_ ...
--   · 所有金额单位统一「元」，用 DECIMAL(10,2)，绝不用浮点数
--   · 所有时间统一 UTC 存储（DATETIME），前端负责转本地时区
--   · 布尔统一 TINYINT(1)：1=是 0=否
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. 用户
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id`              VARCHAR(32)   NOT NULL COMMENT '用户 ID，usr_ 前缀',
  `openid`          VARCHAR(64)   NOT NULL COMMENT '微信小程序 openid',
  `unionid`         VARCHAR(64)       NULL COMMENT '微信开放平台 unionid（可选）',
  `nickname`        VARCHAR(64)   NOT NULL DEFAULT '' COMMENT '昵称',
  `avatar_url`      VARCHAR(512)  NOT NULL DEFAULT '' COMMENT '头像 URL（存 COS）',
  `bio`             VARCHAR(200)  NOT NULL DEFAULT '' COMMENT '一句话简介',

  -- 信用分体系（参数表第 3 章）
  `credit_score`    SMALLINT      NOT NULL DEFAULT 60 COMMENT '信用分 45~100',
  `flags_created`   TINYINT       NOT NULL DEFAULT 0 COMMENT '累计发起 Flag 数（新人保护用）',
  `verified_name`   VARCHAR(64)   NOT NULL DEFAULT '' COMMENT '实名姓名（可选）',
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_openid` (`openid`),
  KEY `idx_credit` (`credit_score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 见证席加入门槛：累计互动次数（参数表 4.15）
DROP TABLE IF EXISTS `user_stat`;
CREATE TABLE `user_stat` (
  `user_id`            VARCHAR(32) NOT NULL,
  `interaction_count`  INT         NOT NULL DEFAULT 0 COMMENT '累计互动次数（申请见证席门槛用）',
  `witness_rate`       DECIMAL(5,4) NOT NULL DEFAULT 1.0000 COMMENT '见证席判定成立率',
  `witness_done`       INT         NOT NULL DEFAULT 0 COMMENT '见证席有效判定次数',
  `witness_miss`       INT         NOT NULL DEFAULT 0 COMMENT '累计未响应次数',
  `credit_logs_count`  INT         NOT NULL DEFAULT 0 COMMENT '信用分流水条数',
  `updated_at`         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_user_stat_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户统计（门槛与校准）';

-- ----------------------------------------------------------------------------
-- 2. Flag（减肥目标）—— 核心业务表
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS `flag`;
CREATE TABLE `flag` (
  `id`             VARCHAR(32)  NOT NULL COMMENT 'Flag ID，flg_ 前缀',
  `user_id`        VARCHAR(32)  NOT NULL COMMENT '发起人',

  -- 立了什么
  `title`          VARCHAR(60)  NOT NULL COMMENT '标题（公开）',
  `reason`         VARCHAR(120) NOT NULL DEFAULT '' COMMENT '立 Flag 的理由（公开）',
  `start_weight`   DECIMAL(6,2) NOT NULL COMMENT '起始体重 kg',
  `target_weight`  DECIMAL(6,2) NOT NULL COMMENT '目标体重 kg',
  `cur_weight`     DECIMAL(6,2)     NULL COMMENT '当前体重 kg（最近一次打卡）',

  -- 周期与日期（参数表 1.2）
  `period_days`    TINYINT      NOT NULL COMMENT '周期天数：7 / 14 / 30 / 90',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发起时间',
  `prep_end_at`    DATETIME     NOT NULL COMMENT '筹备期截止（发起 + 24h）',
  `start_date`     DATE         NOT NULL COMMENT '生效日（第 1 天）',
  `end_date`       DATE         NOT NULL COMMENT '结束日（生效日 + 周期 - 1）',

  -- 状态机（参数表第 10 章）
  `status`         ENUM('prep','running','settling','success','failed','cancelled')
                   NOT NULL DEFAULT 'prep'
                   COMMENT '筹备中/进行中/结算中/成功/失败/取消',

  -- 强度档位 T0~T3（参数表第 2 章）
  `tier`           ENUM('T0','T1','T2','T3') NOT NULL DEFAULT 'T0' COMMENT '当前有效档位',
  `tier_history`   JSON             NULL COMMENT '各节点档位快照 [{node,attended,tier}]',

  -- 押金（参数表第 5 章）
  `deposit_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '押金金额（元）',
  `deposit_paid`   DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '实付押金（结算后仍保留，用于记录卡）',
  `deposit_rate`   DECIMAL(5,4)  NOT NULL DEFAULT 0.3500 COMMENT '失败扣收比例（发起时锁定）',
  `deposit_status` ENUM('none','paying','paid','refunding','refunded','part_refunded')
                    NOT NULL DEFAULT 'none',

  -- 打卡统计
  `checked_days`   TINYINT      NOT NULL DEFAULT 0 COMMENT '已打卡天数',
  `streak`         TINYINT      NOT NULL DEFAULT 0 COMMENT '当前连续打卡天数',
  `breaks`         TINYINT      NOT NULL DEFAULT 0 COMMENT '断卡次数',
  `break_limit`    TINYINT      NOT NULL DEFAULT 0 COMMENT '断卡容忍上限（按周期）',
  `watch_count`    INT          NOT NULL DEFAULT 0 COMMENT '围观人数（监督席）',
  `like_count`     INT          NOT NULL DEFAULT 0 COMMENT '点赞数',

  -- 结算结果
  `result`         ENUM('success','failed','cheat','break')  NULL COMMENT '失败/成功原因分类',
  `lost_amount`    DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '失败实际扣收金额',
  `credit_delta`   SMALLINT     NOT NULL DEFAULT 0 COMMENT '本次结算的信用分变化',
  `settled_at`     DATETIME         NULL COMMENT '结算完成时间',
  `settle_note`    VARCHAR(200) NOT NULL DEFAULT '' COMMENT '结算备注',

  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_flag_user` (`user_id`),
  KEY `idx_flag_status` (`status`, `end_date`),
  KEY `idx_flag_created` (`created_at`),
  CONSTRAINT `fk_flag_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Flag 减肥目标主表';

-- 周期固定参数：断卡容忍上限（参数表 1.7）
--   7天=0 / 14天=1 / 30天=2 / 90天=4
DROP TABLE IF EXISTS `period_config`;
CREATE TABLE `period_config` (
  `period_days`      TINYINT NOT NULL,
  `total_days`       TINYINT NOT NULL COMMENT '打卡日总数',
  `judge_count`      TINYINT NOT NULL COMMENT '见证席判定次数',
  `break_limit`      TINYINT NOT NULL COMMENT '断卡容忍次数',
  `node_days`        JSON    NOT NULL COMMENT '判定节点位置，如 [1,7]',
  `mid_payout_days`  JSON    NOT NULL COMMENT '中期到账日，如 [7]',
  `deposit_min`      DECIMAL(10,2) NOT NULL,
  `deposit_max`      DECIMAL(10,2) NOT NULL,
  `deposit_options`  JSON    NOT NULL COMMENT '固定 4 档展示',
  `success_credit`   SMALLINT NOT NULL COMMENT '成功名义加分',
  `fail_credit`      SMALLINT NOT NULL COMMENT '失败名义扣分',
  `credit_cap`       SMALLINT NOT NULL COMMENT '可立该周期的最低信用分',
  `witness_full_credit` SMALLINT NOT NULL COMMENT '陪到底信用分',
  PRIMARY KEY (`period_days`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='周期配置（参数表第 1、5 章）';

INSERT INTO `period_config` VALUES
  (7,  7,  2, 0, '[1,7]',      '[]',         100.00,   500.00,  '[100,200,300,500]',           5,  -5,  45, 4),
  (14, 14, 3, 1, '[1,7,14]',   '[7]',        200.00,  1000.00,  '[200,300,500,1000]',          10,  -5,  60, 6),
  (30, 30, 4, 2, '[1,10,20,30]','[7]',       500.00,  2000.00,  '[500,1000,1500,2000]',        15, -10, 70, 8),
  (90, 90, 4, 4, '[1,30,60,90]','[7,30]',   1000.00,  5000.00,  '[1000,1500,2000,5000]',       35, -20, 80, 8);

-- 信用等级 → 押金上限 / 扣收比例 / 可立周期（参数表 5.2）
DROP TABLE IF EXISTS `credit_tier`;
CREATE TABLE `credit_tier` (
  `tier_key`      VARCHAR(16) NOT NULL COMMENT '受限/普通/良好/优秀/卓越',
  `min_score`     SMALLINT NOT NULL,
  `max_score`     SMALLINT NOT NULL,
  `deposit_max`   DECIMAL(10,2) NOT NULL,
  `fail_rate`     DECIMAL(5,4) NOT NULL COMMENT '失败扣收比例',
  `allowed_periods` JSON NOT NULL COMMENT '可立周期数组',
  `display_name`  VARCHAR(16) NOT NULL,
  PRIMARY KEY (`tier_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='信用等级配置';

INSERT INTO `credit_tier` VALUES
  ('受限', 45, 59,  200.00, 0.4000, '[7]',             '受限'),
  ('普通', 60, 69,  500.00, 0.3500, '[7,14]',          '普通'),
  ('良好', 70, 79, 1000.00, 0.3000, '[7,14,30]',       '良好'),
  ('优秀', 80, 89, 2000.00, 0.2500, '[7,14,30,90]',    '优秀'),
  ('卓越', 90, 100,5000.00, 0.2000, '[7,14,30,90]',    '卓越');

-- ----------------------------------------------------------------------------
-- 3. 打卡
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS `checkin`;
CREATE TABLE `checkin` (
  `id`            VARCHAR(32) NOT NULL COMMENT '打卡 ID，cki_ 前缀',
  `flag_id`       VARCHAR(32) NOT NULL,
  `user_id`       VARCHAR(32) NOT NULL,
  `day_index`     TINYINT     NOT NULL COMMENT '第几天（1 ~ 周期）',
  `check_date`    DATE        NOT NULL COMMENT '打卡对应的日期',
  `weight`        DECIMAL(6,2) NOT NULL COMMENT '体重秤读数 kg',
  `handwrite`     VARCHAR(200) NOT NULL DEFAULT '' COMMENT '手写词',
  `photo_url`     VARCHAR(512) NOT NULL DEFAULT '' COMMENT '打卡照 URL（COS）',
  `photo_ocr`     VARCHAR(200) NOT NULL DEFAULT '' COMMENT 'OCR 读出的秤面读数',
  `is_makeup`     TINYINT(1)  NOT NULL DEFAULT 0 COMMENT '是否补卡',
  `status`        ENUM('pending','ok','rejected') NOT NULL DEFAULT 'pending'
                  COMMENT '模型判定结果：待审/通过/驳回',
  `ai_verdict`    VARCHAR(200) NOT NULL DEFAULT '' COMMENT '模型判定摘要',
  `ai_score`      DECIMAL(4,3)     NULL COMMENT '模型置信度 0~1',
  `ai_reason`     VARCHAR(500) NOT NULL DEFAULT '' COMMENT '模型判定依据',
  `is_node_day`   TINYINT(1)  NOT NULL DEFAULT 0 COMMENT '是否称重节点日',
  `created_at`    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_flag_day` (`flag_id`, `day_index`),
  KEY `idx_checkin_user` (`user_id`, `check_date`),
  CONSTRAINT `fk_checkin_flag` FOREIGN KEY (`flag_id`) REFERENCES `flag` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日打卡记录';

-- 打卡照额外照片（最多 3 张，参数表 9.2）
DROP TABLE IF EXISTS `checkin_photo`;
CREATE TABLE `checkin_photo` (
  `id`          VARCHAR(32) NOT NULL,
  `checkin_id`  VARCHAR(32) NOT NULL,
  `slot`        TINYINT NOT NULL COMMENT '第几张（0 = 主图）',
  `photo_url`   VARCHAR(512) NOT NULL,
  `is_cover`    TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否封面',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_photo_checkin` (`checkin_id`),
  CONSTRAINT `fk_photo_checkin` FOREIGN KEY (`checkin_id`) REFERENCES `checkin` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打卡额外照片';

-- 模型判定留痕（豆包 / 火山方舟）—— 合规要求：留证可追溯
DROP TABLE IF EXISTS `ai_review`;
CREATE TABLE `ai_review` (
  `id`           VARCHAR(32) NOT NULL,
  `biz_type`     VARCHAR(32) NOT NULL COMMENT 'checkin / weight / photo',
  `biz_id`       VARCHAR(32) NOT NULL COMMENT '业务对象 ID',
  `model`        VARCHAR(64) NOT NULL COMMENT '模型名，如 doubao-vision-pro',
  `prompt_version` VARCHAR(32) NOT NULL DEFAULT 'v1' COMMENT '提示词版本（便于回溯口径变更）',
  `request_id`   VARCHAR(64) NOT NULL DEFAULT '' COMMENT '模型返回的请求 ID',
  `raw_response` JSON            NULL COMMENT '模型原始返回（留证）',
  `verdict`      VARCHAR(32) NOT NULL DEFAULT '' COMMENT '结论',
  `score`        DECIMAL(4,3)     NULL,
  `reason`       VARCHAR(1000) NOT NULL DEFAULT '',
  `cost_ms`      INT             NOT NULL DEFAULT 0 COMMENT '耗时（毫秒）',
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_biz` (`biz_type`, `biz_id`),
  KEY `idx_ai_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 判定留痕表';

-- ----------------------------------------------------------------------------
-- 4. 见证席
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS `flag_witness`;
CREATE TABLE `flag_witness` (
  `id`           VARCHAR(32) NOT NULL,
  `flag_id`      VARCHAR(32) NOT NULL,
  `user_id`      VARCHAR(32) NOT NULL,
  `status`       ENUM('invited','accepted','declined','removed') NOT NULL DEFAULT 'invited'
                 COMMENT '已邀/已接受/已拒绝/已移除',
  `invited_by`   VARCHAR(32) NOT NULL DEFAULT '' COMMENT '邀请人 user_id',
  `invited_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `respond_at`   DATETIME     NULL COMMENT '响应时间（有效期见参数表 4.12）',
  `expire_at`    DATETIME     NULL COMMENT '邀约过期时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_flag_user` (`flag_id`, `user_id`),
  KEY `idx_witness_user` (`user_id`, `status`),
  CONSTRAINT `fk_fw_flag` FOREIGN KEY (`flag_id`) REFERENCES `flag` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fw_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Flag 见证席名单';

-- 见证席判定记录（每个节点每人一票）
DROP TABLE IF EXISTS `verdict`;
CREATE TABLE `verdict` (
  `id`           VARCHAR(32) NOT NULL,
  `flag_id`      VARCHAR(32) NOT NULL,
  `node_index`   TINYINT NOT NULL COMMENT '第几个节点（1 起）',
  `witness_id`   VARCHAR(32) NOT NULL COMMENT '见证人 user_id',
  `decision`     ENUM('pass','cheat','doubt')  NULL COMMENT '通过/判作弊/存疑；NULL = 未响应',
  `evidence_ok`  TINYINT(1)     NULL COMMENT '物证是否合规（判作弊时才用）',
  `reason`       VARCHAR(300) NOT NULL DEFAULT '' COMMENT '判定理由',
  `decided_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `settled`      TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已结算（结算后封存不再公示）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_flag_node_witness` (`flag_id`, `node_index`, `witness_id`),
  KEY `idx_verdict_witness` (`witness_id`),
  CONSTRAINT `fk_verdict_flag` FOREIGN KEY (`flag_id`) REFERENCES `flag` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='见证席判定记录';

-- 见证席候选池（陌生人申请成为见证席）
DROP TABLE IF EXISTS `witness_pool`;
CREATE TABLE `witness_pool` (
  `id`            VARCHAR(32) NOT NULL,
  `user_id`       VARCHAR(32) NOT NULL,
  `status`        ENUM('open','invited','closed') NOT NULL DEFAULT 'open',
  `interaction_count` INT NOT NULL DEFAULT 0 COMMENT '申请时的累计互动次数快照',
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pool_user` (`user_id`),
  CONSTRAINT `fk_pool_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='见证席候选池';

-- 招募（公开招见证席）
DROP TABLE IF EXISTS `recruit`;
CREATE TABLE `recruit` (
  `id`            VARCHAR(32) NOT NULL,
  `flag_id`       VARCHAR(32) NOT NULL,
  `publisher_id`  VARCHAR(32) NOT NULL,
  `slots`         TINYINT NOT NULL DEFAULT 3 COMMENT '坑位数',
  `deadline_at`   DATETIME NOT NULL COMMENT '招募截止',
  `status`        ENUM('open','closed') NOT NULL DEFAULT 'open',
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_recruit_flag` (`flag_id`),
  CONSTRAINT `fk_recruit_flag` FOREIGN KEY (`flag_id`) REFERENCES `flag` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='见证席招募';

DROP TABLE IF EXISTS `recruit_applicant`;
CREATE TABLE `recruit_applicant` (
  `id`          VARCHAR(32) NOT NULL,
  `recruit_id`  VARCHAR(32) NOT NULL,
  `user_id`     VARCHAR(32) NOT NULL,
  `status`      ENUM('applied','accepted','declined') NOT NULL DEFAULT 'applied',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ra` (`recruit_id`, `user_id`),
  CONSTRAINT `fk_ra_recruit` FOREIGN KEY (`recruit_id`) REFERENCES `recruit` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='招募报名';

-- ----------------------------------------------------------------------------
-- 5. 互动
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS `message`;
CREATE TABLE `message` (
  `id`          VARCHAR(32) NOT NULL,
  `flag_id`     VARCHAR(32) NOT NULL,
  `user_id`     VARCHAR(32) NOT NULL COMMENT '留言人',
  `is_anonymous` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否匿名',
  `content`     VARCHAR(300) NOT NULL,
  `reply_to`    VARCHAR(32)     NULL COMMENT '回复的留言 ID',
  `reply_content` VARCHAR(300)  NOT NULL DEFAULT '' COMMENT '回复内容（内联，避免二次查询）',
  `reply_at`    DATETIME         NULL,
  `is_owner_reply` TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否发起人本人回复',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_msg_flag` (`flag_id`, `created_at`),
  CONSTRAINT `fk_msg_flag` FOREIGN KEY (`flag_id`) REFERENCES `flag` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='留言与回复';

DROP TABLE IF EXISTS `like`;
CREATE TABLE `like` (
  `id`          VARCHAR(32) NOT NULL,
  `flag_id`     VARCHAR(32) NOT NULL,
  `user_id`     VARCHAR(32) NOT NULL,
  `phrase`      VARCHAR(32) NOT NULL DEFAULT '' COMMENT '点赞短语',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_like` (`flag_id`, `user_id`),
  CONSTRAINT `fk_like_flag` FOREIGN KEY (`flag_id`) REFERENCES `flag` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='点赞';

DROP TABLE IF EXISTS `supervise`;
CREATE TABLE `supervise` (
  `id`          VARCHAR(32) NOT NULL,
  `flag_id`     VARCHAR(32) NOT NULL,
  `user_id`     VARCHAR(32) NOT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sup` (`flag_id`, `user_id`),
  CONSTRAINT `fk_sup_flag` FOREIGN KEY (`flag_id`) REFERENCES `flag` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='监督席（围观）';

DROP TABLE IF EXISTS `follow`;
CREATE TABLE `follow` (
  `id`          VARCHAR(32) NOT NULL,
  `from_user`   VARCHAR(32) NOT NULL,
  `to_user`     VARCHAR(32) NOT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_follow` (`from_user`, `to_user`),
  CONSTRAINT `fk_fw_from` FOREIGN KEY (`from_user`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fw_to`   FOREIGN KEY (`to_user`)   REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='关注';

-- 异议（举报 / 质疑，参数表第 8 章）
DROP TABLE IF EXISTS `objection`;
CREATE TABLE `objection` (
  `id`            VARCHAR(32) NOT NULL,
  `flag_id`       VARCHAR(32) NOT NULL,
  `user_id`       VARCHAR(32) NOT NULL COMMENT '提出人',
  `type`          ENUM('report','doubt') NOT NULL COMMENT '举报/质疑',
  `reason_code`   VARCHAR(32)  NOT NULL COMMENT '理由代码',
  `content`       VARCHAR(500) NOT NULL DEFAULT '' COMMENT '补充说明',
  `evidence_url`  VARCHAR(512) NOT NULL DEFAULT '' COMMENT '证据图 URL',
  `status`        ENUM('pending','upheld','rejected','withdrawn') NOT NULL DEFAULT 'pending',
  `handled_at`    DATETIME     NULL,
  `handle_note`   VARCHAR(300) NOT NULL DEFAULT '',
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_obj_flag` (`flag_id`, `status`),
  KEY `idx_obj_user` (`user_id`),
  CONSTRAINT `fk_obj_flag` FOREIGN KEY (`flag_id`) REFERENCES `flag` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='异议与举报';

-- ----------------------------------------------------------------------------
-- 6. 支付与押金（微信支付）
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS `pay_order`;
CREATE TABLE `pay_order` (
  `id`             VARCHAR(32) NOT NULL,
  `flag_id`        VARCHAR(32)     NULL COMMENT '关联 Flag（押金）',
  `user_id`        VARCHAR(32) NOT NULL,
  `out_trade_no`   VARCHAR(32) NOT NULL COMMENT '商户订单号（微信支付）',
  `transaction_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '微信支付交易号',
  `amount`         DECIMAL(10,2) NOT NULL COMMENT '金额（元）',
  `refund_amount`  DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '已退金额',
  `type`           ENUM('deposit') NOT NULL DEFAULT 'deposit' COMMENT '押金',
  `status`         ENUM('created','paying','success','closed','refunded','partial_refunded')
                   NOT NULL DEFAULT 'created',
  `notify_raw`     JSON            NULL COMMENT '微信回调原始报文（对账用）',
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at`        DATETIME     NULL,
  `refunded_at`    DATETIME     NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_out_trade_no` (`out_trade_no`),
  KEY `idx_pay_flag` (`flag_id`),
  KEY `idx_pay_user` (`user_id`),
  CONSTRAINT `fk_pay_flag` FOREIGN KEY (`flag_id`) REFERENCES `flag` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付订单';

-- 押金流水：逐用户独立记账（参数表 5.9）
DROP TABLE IF EXISTS `deposit_ledger`;
CREATE TABLE `deposit_ledger` (
  `id`          VARCHAR(32) NOT NULL,
  `flag_id`     VARCHAR(32) NOT NULL,
  `user_id`     VARCHAR(32) NOT NULL,
  `type`        ENUM('in','out') NOT NULL COMMENT 'in=缴入 out=退还/扣收',
  `amount`      DECIMAL(10,2) NOT NULL,
  `reason`      VARCHAR(100) NOT NULL DEFAULT '' COMMENT '原因说明',
  `order_id`    VARCHAR(32)     NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ledger_flag` (`flag_id`),
  KEY `idx_ledger_user` (`user_id`),
  CONSTRAINT `fk_ledger_flag` FOREIGN KEY (`flag_id`) REFERENCES `flag` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='押金流水（逐用户独立记账）';

-- ----------------------------------------------------------------------------
-- 7. 信用分流水（只追加）
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS `credit_log`;
CREATE TABLE `credit_log` (
  `id`          VARCHAR(32) NOT NULL,
  `user_id`     VARCHAR(32) NOT NULL,
  `flag_id`     VARCHAR(32)     NULL,
  `event`       VARCHAR(48) NOT NULL COMMENT '事件码，见规则引擎 EVENT 常量',
  `delta`       SMALLINT    NOT NULL COMMENT '实际入账分值（已乘强度系数）',
  `raw_delta`   SMALLINT    NOT NULL COMMENT '名义分值（未乘系数）',
  `tier_at`     VARCHAR(8)  NOT NULL DEFAULT '' COMMENT '入账时有效档位',
  `note`        VARCHAR(200) NOT NULL DEFAULT '',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cl_user` (`user_id`, `created_at`),
  CONSTRAINT `fk_cl_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='信用分流水（只追加）';

-- ----------------------------------------------------------------------------
-- 8. 通知与记录卡
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS `notification`;
CREATE TABLE `notification` (
  `id`          VARCHAR(32) NOT NULL,
  `user_id`     VARCHAR(32) NOT NULL,
  `type`        VARCHAR(48) NOT NULL COMMENT '通知类型码',
  `title`       VARCHAR(100) NOT NULL,
  `content`     VARCHAR(300) NOT NULL DEFAULT '',
  `flag_id`     VARCHAR(32)     NULL,
  `is_read`     TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_user` (`user_id`, `is_read`, `created_at`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站内通知';

DROP TABLE IF EXISTS `record_card`;
CREATE TABLE `record_card` (
  `id`            VARCHAR(32) NOT NULL,
  `flag_id`       VARCHAR(32) NOT NULL,
  `user_id`       VARCHAR(32) NOT NULL,
  `outcome`       ENUM('success','failed') NOT NULL,
  `tier`          VARCHAR(8)  NOT NULL DEFAULT 'T0' COMMENT '结算时有效档位',
  `witness_ids`   JSON         NOT NULL COMMENT '见证席头像墙',
  `quote`         VARCHAR(300) NOT NULL DEFAULT '' COMMENT '用户金句',
  `share_count`   INT          NOT NULL DEFAULT 0,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rc_flag` (`flag_id`),
  CONSTRAINT `fk_rc_flag` FOREIGN KEY (`flag_id`) REFERENCES `flag` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='记录卡（结局产物）';

-- ----------------------------------------------------------------------------
-- 9. 登录会话
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS `session`;
CREATE TABLE `session` (
  `token`      VARCHAR(64) NOT NULL COMMENT '登录令牌（小程序存本地）',
  `user_id`    VARCHAR(32) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`token`),
  KEY `idx_sess_user` (`user_id`),
  CONSTRAINT `fk_sess_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='登录会话';

SET FOREIGN_KEY_CHECKS = 1;
