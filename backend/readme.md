# APS智能排产演示系统

基于FastAPI和ALNS（自适应大邻域搜索）算法的智能高级计划与排产（APS）系统，用于优化制造订单的生产顺序，减少切换次数，提高批次合格率。

---

## 📋 目录

- [快速开始](#快速开始)
- [项目架构](#项目架构)
- [排产计划模块算法设计](#排产计划模块算法设计)
  - [核心算法：简化版ALNS](#核心算法简化版alns)
  - [算法执行流程](#算法执行流程)
  - [评分机制](#评分机制)
  - [邻域操作算子](#邻域操作算子)
- [算法优劣势分析](#算法优劣势分析)
- [API接口说明](#api接口说明)
- [技术栈](#技术栈)

---

## 🚀 快速开始

### 环境要求

- Python 3.8+
- SQLite3（内置）

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动项目

在项目根目录下直接运行：

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动，自动打开浏览器访问前端界面。

**主要特点：**
- 使用Uvicorn作为ASGI服务器，支持异步高性能处理
- 启用热重载模式（`reload=True`），代码修改后自动重启
- 绑定到 `0.0.0.0:8000`，支持局域网访问
- 首次启动时自动初始化SQLite数据库

---

## 🏗️ 项目架构

```
backend/
├── main.py              # FastAPI应用入口，定义所有REST API路由
├── optimizer.py         # ALNS排产优化算法核心实现
├── database.py          # SQLite数据库连接与操作封装
├── config.py            # 全局配置（路径、版本等）
├── requirements.txt     # Python依赖包
└── uploads/             # 文件上传目录
```

**分层设计：**
1. **API层**（`main.py`）：处理HTTP请求、参数验证、响应格式化
2. **算法层**（`optimizer.py`）：实现SimplifiedALNS优化器
3. **数据层**（`database.py`）：提供统一的数据库查询和执行接口
4. **配置层**（`config.py`）：集中管理路径和常量

---

## 🧠 排产计划模块算法设计

### 核心算法：简化版ALNS

本系统采用**自适应大邻域搜索（Adaptive Large Neighborhood Search, ALNS）**的简化版本进行排产优化。ALNS是一种元启发式算法，通过迭代地破坏和修复解来寻找最优解，特别适用于组合优化问题。

#### 算法设计理念

传统ALNS算法包含复杂的自适应权重调整机制，本系统针对演示场景进行了简化：

1. **固定迭代次数**：执行50次迭代优化（而非动态收敛判断）
2. **随机选择算子**：均匀概率选择4种邻域操作（而非基于历史表现加权）
3. **模拟退火接受准则**：前期严格接受更优解，后期以10%概率接受劣解以跳出局部最优

#### 关键数据结构

```python
class SimplifiedALNS:
    orders: List[Dict]          # 待排产订单列表
    constraints: List[Dict]     # 约束配置（批次限制、间隔限制）
    batch_limit: Dict           # 各属性的最小/最大批量限制
    gap_limit: Dict             # 各属性的间隔限制
```

---

### 算法执行流程

#### 第一阶段：数据加载与预处理

**步骤1：加载待排产订单**
```python
# 从数据库查询状态为0（待排产）的订单
SELECT o.*, p.name, p.attr_a, p.attr_b, 
       p.composite_craft, p.special_component
FROM "order" o 
JOIN product p ON o.product_id = p.id
WHERE o.status = 0
ORDER BY o.priority, o.deadline
```

**步骤2：加载激活的约束配置**
```python
# 获取所有启用的约束规则
SELECT * FROM constraint_config WHERE is_active = 1
```

约束类型包括：
- **批次约束**（batch_limit）：定义某属性相同订单的最小/最大连续数量
- **间隔约束**（gap_limit）：定义不同属性订单之间的最小间隔数

**步骤3：构建约束字典**
```python
for constraint in constraints:
    key = constraint["constraint_name"]  # 如 "attr_a", "composite_craft"
    batch_limit[key] = [min_batch, max_batch]
    if gap_limit > 0:
        gap_limit[key] = gap_limit
```

---

#### 第二阶段：初始解构造

**排序策略（多关键字排序）**
```python
seq.sort(key=lambda x: (
    x["priority"],      # 第一优先级：订单优先级（数字越小越优先）
    x.get("attr_a", ""), # 第二优先级：属性A聚类
    x.get("attr_b", "")  # 第三优先级：属性B聚类
))
```

**设计意图：**
- 优先保证高优先级订单排在前面
- 按属性A和属性B聚类，减少后续优化的切换次数
- 形成相对合理的初始解，加速收敛

---

#### 第三阶段：ALNS迭代优化（50次迭代）

每次迭代执行以下流程：

##### 1. 随机选择邻域操作算子

系统实现了4种邻域操作，随机选择其一：

**算子1：2-opt反转（op=0）**
```python
# 随机选择序列中的一段并反转
i = random.randint(0, len(seq) - 2)
j = random.randint(i + 1, len(seq) - 1)
seq[i:j+1] = reversed(seq[i:j+1])
```
**作用**：大幅改变局部顺序，可能显著减少切换次数

**算子2：移位操作（op=1）**
```python
# 将一个订单从位置i移动到位置j
item = seq.pop(i)
seq.insert(j, item)
```
**作用**：微调单个订单位置，适合局部优化

**算子3：交换操作（op=2）**
```python
# 交换两个位置的订单
seq[i], seq[j] = seq[j], seq[i]
```
**作用**：快速尝试不同组合，探索解空间

**算子4：重聚类（op=3）**
```python
# 完全按属性A和属性B重新排序
seq.sort(key=lambda x: (x.get("attr_a", ""), x.get("attr_b", "")))
```
**作用**：彻底重组序列，跳出局部最优

##### 2. 计算新解得分

调用 `compute_score(new_seq)` 计算综合得分（详见评分机制部分）。

##### 3. 接受准则（模拟退火思想）

```python
if score < best_score or (iteration > 20 and random.random() < 0.1):
    best_seq = new_seq
    best_score = score
```

**策略说明：**
- **前20次迭代**：只接受更优解（贪心策略），快速收敛
- **后30次迭代**：以10%概率接受劣解（探索策略），避免陷入局部最优
- 这种混合策略平衡了**开发（exploitation）**和**探索（exploration）**

---

#### 第四阶段：结果评估与输出

**优化前后对比**

1. **基线方案**（优化前）：按订单ID排序
   ```python
   baseline.sort(key=lambda x: x["id"])
   _, before_switch, before_batch, before_gap = compute_score(baseline)
   ```

2. **优化方案**（优化后）：ALNS得到的最优序列

3. **生成详细排产明细**
   ```python
   {
       "order_id": 订单ID,
       "order_no": 订单编号,
       "product_name": 产品名称,
       "attr_a/b": 产品属性,
       "composite_craft": 复合工艺,
       "special_component": 特殊组件,
       "quantity": 数量,
       "priority": 优先级,
       "deadline": 交期,
       "batch_id": 分配的批次号
   }
   ```

4. **批次号分配逻辑**
   ```python
   def _assign_batch(sequence, idx):
       if idx == 0:
           return 1
       prev = sequence[idx - 1]
       curr = sequence[idx]
       # 如果相邻订单的属性A和B相同，则属于同一批次
       if (prev.get("attr_a") == curr.get("attr_a") and
               prev.get("attr_b") == curr.get("attr_b")):
           return previous_batch_id  # 同批次
       return new_batch_id  # 新批次
   ```

---

### 评分机制

评分函数是算法的核心，决定了优化方向。采用**加权多目标评分**，得分越低越好。

#### 评分公式

```python
score = total_switch * 0.4 + (1 - avg_batch_rate) * 30 + (1 - avg_gap_rate) * 20
```

#### 三个关键指标

**1. 切换次数（Switch Count）**

计算四个属性维度的总切换次数：
```python
attrs_switch = ["attr_a", "attr_b", "composite_craft", "special_component"]

def switch_count(sequence, attr):
    count = 0
    for i in range(len(sequence) - 1):
        if sequence[i][attr] != sequence[i + 1][attr]:
            count += 1  # 相邻订单属性不同，计一次切换
    return count
```

**示例：**
```
订单序列：[A1, A1, A2, A2, A1]
attr_a切换次数 = 2（A1→A2, A2→A1）
```

**权重：0.4** —— 切换成本相对较低，但频繁切换影响效率

---

**2. 批次合格率（Batch Quality Rate）**

衡量相同属性订单的连续数量是否符合批次限制：

```python
def batch_quality(sequence, attr):
    low, up = batch_limit[attr]  # 获取最小/最大批量
    n_true, n_false = 0, 0
    
    # 按属性值分组（连续相同属性视为一批）
    for k, g in groupby(sequence, key=lambda x: x.get(attr, "")):
        if k and k != "" and k != "无":
            batch_size = sum(1 for _ in g)
            if low <= batch_size <= up:
                n_true += 1   # 符合批次限制
            else:
                n_false += 1  # 不符合
    
    return n_true / (n_true + n_false)
```

**示例：**
```
批次限制：min_batch=2, max_batch=5
订单序列：[A, A, A, B, B, B, B, B, B]
- A批次大小=3 → 合格 ✓
- B批次大小=6 → 不合格 ✗
批次合格率 = 1/2 = 50%
```

**权重：30** —— 批次合规性非常重要，影响生产效率和成本控制

---

**3. 间隔合格率（Gap Quality Rate）**

衡量不同属性订单之间的间隔是否满足最小间隔要求：

```python
def gap_quality(sequence, attr):
    limit = gap_limit[attr]  # 最小间隔数
    n_true, n_false = 0, 0
    
    for k, g in groupby(sequence, key=lambda x: x.get(attr, "")):
        g_size = sum(1 for _ in g)
        if k == "" or k == "other":  # 特殊属性需要间隔
            if g_size >= limit:
                n_true += 1
            else:
                n_false += 1
        else:
            n_true += 1  # 普通属性无需间隔
    
    return n_true / (n_true + n_false)
```

**应用场景：**
- 某些特殊工艺需要冷却时间或清洁时间
- 避免连续生产相似产品导致的质量风险

**权重：20** —— 间隔合规性重要但次于批次合规性

---

### 邻域操作算子详解

| 算子 | 操作类型 | 破坏程度 | 适用场景 |
|------|---------|---------|---------|
| 2-opt反转 | 局部反转 | 中等 | 消除交叉路径，减少切换 |
| 移位 | 单点移动 | 较小 | 微调订单位置 |
| 交换 | 两点互换 | 较小 | 快速尝试局部改进 |
| 重聚类 | 全局重排 | 较大 | 跳出局部最优，重新组织 |

**算子选择策略：**
- 当前实现：均匀随机选择（`random.randint(0, 3)`）
- 改进方向：可根据历史成功率动态调整权重（标准ALNS做法）

---

## ⚖️ 算法优劣势分析

### ✅ 优势

#### 1. **求解质量高**
- **多目标优化**：同时考虑切换次数、批次合格率、间隔合格率，避免单一目标的局限性
- **全局搜索能力强**：通过4种邻域算子组合，能够充分探索解空间
- **避免局部最优**：引入模拟退火思想，后期允许接受劣解，增加跳出局部最优的概率

#### 2. **灵活性强**
- **可配置约束**：通过数据库动态配置批次限制和间隔限制，无需修改代码
- **可扩展属性**：轻松添加新的产品属性维度（只需在`attrs_switch`中添加字段名）
- **权重可调**：评分公式中的权重系数可根据实际业务需求调整

#### 3. **实现简洁高效**
- **代码可读性好**：简化版ALNS去除了复杂的自适应机制，逻辑清晰易懂
- **计算效率高**：50次迭代对于中小规模问题（<1000订单）可在秒级完成
- **内存占用低**：仅维护当前解和最优解，空间复杂度O(n)

#### 4. **实用性强**
- **对比基准明确**：提供优化前后的详细对比指标，便于评估效果
- **结果可解释**：每个订单的批次号、属性、优先级等信息完整保留
- **可视化友好**：输出的结构化数据可直接用于甘特图展示

---

### ❌ 劣势

#### 1. **性能局限**
- **大规模问题效率低**：订单量超过1000时，50次迭代可能不足以找到优质解
- **时间复杂度较高**：每次迭代需遍历整个序列计算评分，最坏情况O(n²)
- **无法保证最优解**：作为启发式算法，只能得到近似最优解，且每次运行结果可能不同

#### 2. **算法简化带来的问题**
- **缺少自适应机制**：标准ALNS会根据算子历史表现动态调整选择概率，本系统采用均匀随机，可能导致低效算子被过度使用
- **固定迭代次数**：未实现收敛判断，可能在已收敛后仍继续无效迭代，或过早停止
- **冷却 schedule 简单**：模拟退火的接受概率固定为10%，未随温度递减

#### 3. **评分函数设计缺陷**
- **权重凭经验设定**：0.4、30、20的权重缺乏理论依据，可能需要大量实验调参
- **量纲不统一**：切换次数是绝对值，合格率是百分比，直接加权可能导致某一主导
- **未考虑交期紧迫度**：评分函数未纳入订单交期和优先级，可能导致紧急订单被延后

#### 4. **实际应用限制**
- **单机串行处理**：未利用多核并行，无法加速大规模问题求解
- **无缓存机制**：每次优化从头开始，未利用历史计算结果
- **约束处理能力有限**：仅支持批次和间隔约束，无法处理复杂的时间窗、资源冲突等约束

#### 5. **数据依赖性**
- **依赖产品质量数据**：需要准确的产品属性（attr_a, attr_b等）数据，否则优化效果大打折扣
- **冷启动问题**：新系统初期缺乏历史数据，约束配置难以合理设定

---

### 🔧 改进建议

1. **引入自适应权重**：记录每个算子的成功率和改进幅度，动态调整选择概率
2. **实现收敛判断**：当连续N次迭代未改进时提前终止
3. **多起点搜索**：从多个不同的初始解出发并行搜索，取最优结果
4. **混合算法**：结合遗传算法、禁忌搜索等其他元启发式算法
5. **增量优化**：对已有排产结果进行局部调整，而非全量重排
6. **机器学习辅助**：使用历史数据训练模型，预测优质解的特征，指导搜索方向

---

## 📡 API接口说明

### 排产计划相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/schedule/optimize` | POST | 执行排产优化 |
| `/api/schedule/result/{result_id}` | GET | 获取指定排产结果 |
| `/api/schedule/results` | GET | 获取所有排产结果列表 |
| `/api/schedule/export/{result_id}` | GET | 导出排产结果为CSV |
| `/api/schedule/gantt-data/{result_id}` | GET | 获取甘特图数据 |

### 订单管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/orders` | GET | 获取订单列表（支持分页和状态过滤） |
| `/api/orders/{order_id}` | GET | 获取单个订单详情 |
| `/api/orders` | POST | 创建新订单 |
| `/api/orders/{order_id}/priority` | PUT | 更新订单优先级 |
| `/api/orders/import` | POST | 批量导入订单（CSV/Excel） |

### 约束配置

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/constraints` | GET | 获取所有约束配置 |
| `/api/constraints` | PUT | 批量更新约束配置 |

### 基础数据

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/products` | GET | 获取产品列表 |

---

## 🛠️ 技术栈

- **Web框架**：FastAPI 0.100+
- **ASGI服务器**：Uvicorn
- **数据库**：SQLite3（WAL模式支持并发）
- **数据处理**：openpyxl（Excel解析）、csv（CSV处理）
- **算法库**：纯Python实现（无第三方优化库依赖）
- **数据验证**：Pydantic

---

## 📝 许可证

本项目仅供学习和演示使用。

---

## 👥 贡献

欢迎提交Issue和Pull Request！

---

**开发时间**：2026年5月  
**版本**：v2.0.0
