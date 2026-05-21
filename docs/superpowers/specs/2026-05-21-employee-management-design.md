# 人员管理功能设计文档

**日期：** 2026-05-21
**模块：** 人员管理 CRUD
**状态：** 已批准，待实现

---

## 1. 功能范围

完整 CRUD（创建、读取、更新、删除），管理员模式（所有登录用户都有操作权限）。

---

## 2. 数据模型

**表名：** `employee`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | INTEGER | 自增 | 主键 |
| name | TEXT | ✅ | 姓名 |
| role | TEXT | ✅ | 角色（操作工、技术员、质检员等） |
| team | TEXT | - | 班组（A班、B班、维修组） |
| phone | TEXT | - | 联系方式 |
| status | INTEGER | ✅ | 状态（1=在岗, 0=离线, 2=休假） |

---

## 3. API 设计（RESTful）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/employees` | 获取员工列表 |
| GET | `/api/employees/{id}` | 获取单个员工 |
| POST | `/api/employees` | 新增员工 |
| PUT | `/api/employees/{id}` | 更新员工 |
| DELETE | `/api/employees/{id}` | 删除员工 |

### 请求/响应格式

**POST /api/employees**
```json
// Request
{ "name": "张三", "role": "操作工", "team": "A班", "phone": "13800138000", "status": 1 }

// Response 201
{ "id": 9, "name": "张三", "role": "操作工", "team": "A班", "phone": "13800138000", "status": 1 }

// Response 400 (validation error)
{ "detail": "姓名为必填字段" }
```

**PUT /api/employees/{id}**
```json
// Request
{ "name": "张三", "role": "生产主管", "team": "A班", "phone": "13800138000", "status": 1 }

// Response 200
{ "id": 1, "name": "张三", "role": "生产主管", "team": "A班", "phone": "13800138000", "status": 1 }

// Response 404
{ "detail": "员工不存在" }
```

**DELETE /api/employees/{id}**
```json
// Response 200
{ "message": "删除成功" }

// Response 404
{ "detail": "员工不存在" }
```

---

## 4. 前端交互

### 列表展示
- 简单表格，显示：姓名、角色、班组、联系方式、状态
- 状态 Badge：在岗(绿)、离线(灰)、休假(橙)

### 添加/编辑
- 弹窗表单 Modal（居中遮罩层）
- 字段：姓名、角色、班组、电话、状态
- 添加时 status 默认选「在岗」
- 按钮：「取消」和「保存」

### 删除
- 每行有「编辑」「删除」按钮
- 点击删除弹出确认框：「确定要删除 [姓名] 吗？」
- 确认后执行删除，列表自动刷新

### 操作按钮布局
| 列 | 操作 |
|---|------|
| 姓名 | - |
| 角色 | - |
| 班组 | - |
| 联系方式 | - |
| 状态 | - |
| 操作 | 编辑 / 删除 |

---

## 5. 数据校验

- **前端**：必填字段（姓名、角色）不能为空，状态为必选
- **后端**：必填校验，返回友好错误信息（如 "姓名为必填字段"）

---

## 6. 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/main.py` | 新增 5 个 API 端点 |
| `backend/database.py` | 新增通用 CRUD 方法 |
| `frontend/js/api.js` | 新增 API 客户端方法 |
| `frontend/js/app.js` | 修改 `renderEmployees()`，添加增删改 UI |
| `frontend/index.html` | 引入表单 Modal HTML |

---

## 7. 实现顺序

1. 后端 API（CRUD 端点 + database 方法）
2. 前端 API 客户端（api.js）
3. 前端页面改造（app.js + index.html）