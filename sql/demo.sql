-- ============================================
-- 工厂排产演示系统 - SQLite 数据库初始化脚本
-- ============================================

-- 产品表
DROP TABLE IF EXISTS product;
CREATE TABLE product (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    attr_a TEXT DEFAULT '',
    attr_b TEXT DEFAULT '',
    composite_craft TEXT DEFAULT '',
    special_component TEXT DEFAULT '',
    model_type TEXT DEFAULT '',
    craft_type TEXT DEFAULT '',
    appearance_spec TEXT DEFAULT '',
    description TEXT DEFAULT '',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 订单表
DROP TABLE IF EXISTS "order";
CREATE TABLE "order" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    deadline TEXT,
    priority INTEGER DEFAULT 5,
    status INTEGER DEFAULT 0,
    customer TEXT DEFAULT '',
    remark TEXT DEFAULT '',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES product(id)
);

-- 排产结果表
DROP TABLE IF EXISTS schedule_result;
CREATE TABLE schedule_result (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_sequence TEXT NOT NULL,
    score REAL DEFAULT 0,
    switch_count_before INTEGER DEFAULT 0,
    switch_count_after INTEGER DEFAULT 0,
    batch_rate_before REAL DEFAULT 0,
    batch_rate_after REAL DEFAULT 0,
    gap_rate_before REAL DEFAULT 0,
    gap_rate_after REAL DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 约束配置表
DROP TABLE IF EXISTS constraint_config;
CREATE TABLE constraint_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    constraint_name TEXT UNIQUE NOT NULL,
    min_batch INTEGER DEFAULT 1,
    max_batch INTEGER DEFAULT 9999,
    gap_limit INTEGER DEFAULT 0,
    weight REAL DEFAULT 1.0,
    is_active INTEGER DEFAULT 1,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO constraint_config (constraint_name, min_batch, max_batch, gap_limit, weight) VALUES
('属性A', 15, 30, 60, 1.0),
('属性B', 15, 9999, 0, 1.0),
('复合工艺', 1, 4, 60, 1.2),
('特殊组件', 1, 1, 30, 1.5);

-- 员工表
DROP TABLE IF EXISTS employee;
CREATE TABLE employee (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT DEFAULT '操作工',
    team TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    status INTEGER DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 设备表
DROP TABLE IF EXISTS equipment;
CREATE TABLE equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT DEFAULT '',
    status INTEGER DEFAULT 0,
    oee REAL DEFAULT 0,
    temperature REAL DEFAULT 0,
    vibration REAL DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 物料表
DROP TABLE IF EXISTS material;
CREATE TABLE material (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 100,
    unit TEXT DEFAULT '个',
    supplier TEXT DEFAULT '',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 排产明细表
DROP TABLE IF EXISTS schedule_detail;
CREATE TABLE schedule_detail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    result_id INTEGER NOT NULL,
    sequence_no INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    product_name TEXT DEFAULT '',
    attr_a TEXT DEFAULT '',
    attr_b TEXT DEFAULT '',
    composite_craft TEXT DEFAULT '',
    special_component TEXT DEFAULT '',
    quantity INTEGER DEFAULT 0,
    batch_id INTEGER DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (result_id) REFERENCES schedule_result(id)
);

-- 产品数据
INSERT INTO product (name, attr_a, attr_b, composite_craft, special_component, model_type, craft_type, appearance_spec) VALUES
('设备一', '精密A1', '标准B1', '无', '无', 'ML-A100', '标准工艺', '雾面银'),
('设备二', '精密A2', '标准B1', '复合工艺X', '特殊组件α', 'ML-B200', '精密工艺', '亮面黑'),
('设备三', '精密A1', '标准B2', '无', '无', 'ML-A100', '标准工艺', '珍珠白'),
('设备四', '精密A3', '标准B3', '复合工艺Y', '特殊组件β', 'ML-C300', '高温工艺', '星空蓝'),
('设备五', '精密A2', '标准B2', '无', '无', 'ML-B200', '精密工艺', '金属灰'),
('设备六', '精密A1', '标准B1', '复合工艺X', '无', 'ML-A100', '标准工艺', '珊瑚红'),
('设备七', '精密A3', '标准B3', '无', '特殊组件α', 'ML-C300', '高温工艺', '钨钢色'),
('设备八', '精密A4', '标准B4', '复合工艺Y', '无', 'ML-D400', '超精工艺', '镜面银');

-- 订单数据
INSERT INTO "order" (order_no, product_id, quantity, deadline, priority, status, customer) VALUES
('ORD-2026-0001', 1, 120, '2026-05-20', 3, 0, '客户A'),
('ORD-2026-0002', 2, 80, '2026-05-21', 4, 0, '客户B'),
('ORD-2026-0003', 3, 200, '2026-05-22', 2, 0, '客户A'),
('ORD-2026-0004', 4, 60, '2026-05-23', 5, 0, '客户C'),
('ORD-2026-0005', 5, 150, '2026-05-20', 1, 0, '客户D'),
('ORD-2026-0006', 6, 90, '2026-05-24', 4, 0, '客户B'),
('ORD-2026-0007', 7, 110, '2026-05-25', 3, 0, '客户E'),
('ORD-2026-0008', 8, 70, '2026-05-21', 5, 0, '客户C'),
('ORD-2026-0009', 1, 180, '2026-05-26', 2, 0, '客户F'),
('ORD-2026-0010', 3, 95, '2026-05-22', 4, 0, '客户D'),
('ORD-2026-0011', 5, 130, '2026-05-27', 3, 0, '客户A'),
('ORD-2026-0012', 2, 160, '2026-05-23', 1, 0, '客户E'),
('ORD-2026-0013', 4, 75, '2026-05-28', 5, 0, '客户F'),
('ORD-2026-0014', 6, 140, '2026-05-24', 3, 0, '客户B'),
('ORD-2026-0015', 8, 100, '2026-05-29', 4, 0, '客户C'),
('ORD-2026-0016', 7, 85, '2026-05-25', 2, 0, '客户D'),
('ORD-2026-0017', 1, 200, '2026-05-30', 1, 0, '客户A'),
('ORD-2026-0018', 3, 55, '2026-05-26', 5, 0, '客户E'),
('ORD-2026-0019', 5, 170, '2026-05-31', 3, 0, '客户F'),
('ORD-2026-0020', 2, 90, '2026-05-27', 4, 0, '客户B');

-- 员工数据
INSERT INTO employee (name, role, team, status) VALUES
('张三', '生产主管', 'A班', 1),
('李四', '操作工', 'A班', 1),
('王五', '技术员', 'B班', 1),
('赵六', '质检员', 'A班', 1),
('孙七', '操作工', 'B班', 0),
('周八', '维修工', '维修组', 2),
('吴九', '操作工', 'A班', 1),
('郑十', '班组长', 'B班', 1);

-- 设备数据
INSERT INTO equipment (name, type, status, oee, temperature, vibration) VALUES
('设备一', 'CNC加工中心', 0, 85.5, 42.3, 0.15),
('设备二', '注塑机', 0, 92.1, 58.7, 0.08),
('设备三', '冲压机', 1, 0, 35.2, 0.22),
('设备四', '焊接机器人', 0, 78.9, 45.6, 0.12),
('设备五', '装配线', 0, 88.3, 38.1, 0.10),
('设备六', '检测仪', 2, 0, 28.4, 0.05);

-- 物料数据
INSERT INTO material (name, stock, min_stock, unit, supplier) VALUES
('铝合金板材', 5000, 1000, 'kg', '供应商A'),
('特种钢材', 1200, 500, 'kg', '供应商B'),
('电子元器件', 8000, 2000, '个', '供应商C'),
('润滑油脂', 300, 100, '升', '供应商D'),
('包装材料', 10000, 3000, '个', '供应商E'),
('精密轴承', 600, 200, '套', '供应商F');
