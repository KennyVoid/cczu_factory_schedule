# 人员管理 CRUD 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal：** 为人员管理模块添加完整的增删改查功能，包括后端 API、前端 API 客户端和前端页面改造。

**Architecture：**
- 后端新增 5 个 RESTful 端点在 `backend/main.py`
- 新增 `backend/database.py` 的 `get_one()` 方法支持单行查询
- 前端 `api.js` 新增 `employees` 模块，对应后端 API
- 前端 `app.js` 改造 `renderEmployees()` 添加 Modal 表单和操作按钮

**Tech Stack：** Python FastAPI / SQLite / Vanilla JS

---

## 文件结构

| 文件 | 改动 |
|------|------|
| `backend/database.py` | 新增 `get_one()` 方法 |
| `backend/main.py` | 新增 5 个 CRUD 端点；删除旧的 `/api/dashboard/employees` 端点 |
| `frontend/js/api.js` | 新增 `employees` 模块（list/get/create/update/remove） |
| `frontend/js/app.js` | 改造 `renderEmployees()`，新增 Modal 和操作按钮 |
| `frontend/index.html` | 新增表单 Modal HTML 结构 |

---

## Task 1: 后端 Database 新增 get_one 方法

**Files:**
- Modify: `backend/database.py:58-77`

- [ ] **Step 1: 在 query() 后新增 get_one() 方法**

在 `database.py` 的 `query()` 函数后面插入：

```python
def get_one(sql, params=None):
    max_retries = 3
    retry_delay = 0.1

    for attempt in range(max_retries):
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(sql, params or [])
            row = cursor.fetchone()
            conn.close()
            return dict(row) if row else None
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower() and attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))
                continue
            else:
                raise
```

- [ ] **Step 2: 提交**

```bash
git add backend/database.py
git commit -m "feat(employee): add get_one() helper for single row queries"
```

---

## Task 2: 后端 CRUD API 端点

**Files:**
- Modify: `backend/main.py:411-463`

- [ ] **Step 1: 删除旧的 dashboard employees 端点并添加新的 CRUD 端点**

将 `main.py` 中现有的：

```python
@app.get("/api/dashboard/employees")
async def get_employees():
    return make_mock_data("employee")
```

替换为以下 5 个端点（插入到 `make_mock_data` 函数后面）：

```python
@app.get("/api/employees")
async def list_employees():
    return query("SELECT * FROM employee ORDER BY id")

@app.get("/api/employees/{employee_id}")
async def get_employee(employee_id: int):
    emp = get_one("SELECT * FROM employee WHERE id = ?", (employee_id,))
    if not emp:
        raise HTTPException(status_code=404, detail="员工不存在")
    return emp

@app.post("/api/employees")
async def create_employee(emp: Employee):
    # Validation
    if not emp.name or not emp.name.strip():
        raise HTTPException(status_code=400, detail="姓名为必填字段")
    if not emp.role or not emp.role.strip():
        raise HTTPException(status_code=400, detail="角色为必填字段")
    if emp.status is None:
        raise HTTPException(status_code=400, detail="状态为必填字段")

    last_id = execute(
        "INSERT INTO employee (name, role, team, phone, status) VALUES (?, ?, ?, ?, ?)",
        (emp.name.strip(), emp.role.strip(), emp.team or '', emp.phone or '', emp.status)
    )
    return get_one("SELECT * FROM employee WHERE id = ?", (last_id,))

@app.put("/api/employees/{employee_id}")
async def update_employee(employee_id: int, emp: Employee):
    # Check exists
    existing = get_one("SELECT * FROM employee WHERE id = ?", (employee_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="员工不存在")

    # Validation
    if not emp.name or not emp.name.strip():
        raise HTTPException(status_code=400, detail="姓名为必填字段")
    if not emp.role or not emp.role.strip():
        raise HTTPException(status_code=400, detail="角色为必填字段")
    if emp.status is None:
        raise HTTPException(status_code=400, detail="状态为必填字段")

    execute(
        "UPDATE employee SET name=?, role=?, team=?, phone=?, status=? WHERE id=?",
        (emp.name.strip(), emp.role.strip(), emp.team or '', emp.phone or '', emp.status, employee_id)
    )
    return get_one("SELECT * FROM employee WHERE id = ?", (employee_id,))

@app.delete("/api/employees/{employee_id}")
async def delete_employee(employee_id: int):
    existing = get_one("SELECT * FROM employee WHERE id = ?", (employee_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="员工不存在")

    execute("DELETE FROM employee WHERE id = ?", (employee_id,))
    return {"message": "删除成功"}
```

- [ ] **Step 2: 在文件顶部添加 HTTPException 导入**

检查 `main.py` 顶部是否有 `from fastapi import ... HTTPException`，如果没有则添加。

- [ ] **Step 3: 在文件顶部添加 Pydantic 模型**

在 `main.py` 顶部（其他模型定义附近）添加：

```python
from pydantic import BaseModel

class Employee(BaseModel):
    name: str = ""
    role: str = ""
    team: str = ""
    phone: str = ""
    status: int = 1
```

- [ ] **Step 4: 提交**

```bash
git add backend/main.py
git commit -m "feat(employee): add RESTful CRUD API endpoints"
```

---

## Task 3: 前端 API 客户端

**Files:**
- Modify: `frontend/js/api.js:100-121`

- [ ] **Step 1: 在 API return 语句前添加 employees 模块**

在 `api.js` 的 `return { request, schedule, orders, constraints, products, dashboard };` 之前插入：

```javascript
// ===== Employees =====
const employees = {
    list() { return request('GET', '/api/employees'); },
    get(id) { return request('GET', `/api/employees/${id}`); },
    create(data) { return request('POST', '/api/employees', data); },
    update(id, data) { return request('PUT', `/api/employees/${id}`, data); },
    remove(id) { return request('DELETE', `/api/employees/${id}`); },
};
```

- [ ] **Step 2: 更新 return 语句**

将 `return { request, schedule, orders, constraints, products, dashboard };` 改为：
`return { request, schedule, orders, constraints, products, dashboard, employees };`

- [ ] **Step 3: 提交**

```bash
git add frontend/js/api.js
git commit -m "feat(employee): add employees API client module"
```

---

## Task 4: 前端页面改造 - Modal 和操作按钮

**Files:**
- Modify: `frontend/index.html`（添加 Modal HTML）
- Modify: `frontend/js/app.js:985-1029`（改造 renderEmployees 函数）

- [ ] **Step 1: 在 index.html 添加 Modal HTML**

在 `index.html` 的 `</body>` 前添加以下 Modal 结构：

```html
<!-- 员工管理 Modal -->
<div id="employeeModal" class="modal" style="display:none;">
    <div class="modal-content">
        <div class="modal-header">
            <h3 id="employeeModalTitle">添加员工</h3>
            <span class="modal-close" onclick="App.closeEmployeeModal()">&times;</span>
        </div>
        <div class="modal-body">
            <input type="hidden" id="employeeId">
            <div class="form-group">
                <label>姓名 <span class="required">*</span></label>
                <input type="text" id="employeeName" placeholder="请输入姓名">
            </div>
            <div class="form-group">
                <label>角色 <span class="required">*</span></label>
                <input type="text" id="employeeRole" placeholder="请输入角色">
            </div>
            <div class="form-group">
                <label>班组</label>
                <input type="text" id="employeeTeam" placeholder="如：A班、B班">
            </div>
            <div class="form-group">
                <label>联系方式</label>
                <input type="text" id="employeePhone" placeholder="手机号">
            </div>
            <div class="form-group">
                <label>状态 <span class="required">*</span></label>
                <select id="employeeStatus">
                    <option value="1">在岗</option>
                    <option value="0">离线</option>
                    <option value="2">休假</option>
                </select>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-outline" onclick="App.closeEmployeeModal()">取消</button>
            <button class="btn btn-primary" onclick="App.saveEmployee()">保存</button>
        </div>
    </div>
</div>

<!-- 删除确认 Modal -->
<div id="deleteModal" class="modal" style="display:none;">
    <div class="modal-content modal-sm">
        <div class="modal-header">
            <h3>确认删除</h3>
            <span class="modal-close" onclick="App.closeDeleteModal()">&times;</span>
        </div>
        <div class="modal-body">
            <p>确定要删除 <strong id="deleteEmployeeName"></strong> 吗？</p>
        </div>
        <div class="modal-footer">
            <button class="btn btn-outline" onclick="App.closeDeleteModal()">取消</button>
            <button class="btn btn-danger" onclick="App.confirmDelete()">删除</button>
        </div>
    </div>
</div>
```

- [ ] **Step 2: 在 app.js 添加 Modal 样式**

在 `app.js` 顶部（CSS 定义附近）添加：

```javascript
// Modal styles
const modalStyle = `
.modal { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1000; }
.modal-content { background:#fff; border-radius:8px; width:420px; max-width:90%; }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid #eee; }
.modal-header h3 { margin:0; font-size:18px; }
.modal-close { font-size:24px; cursor:pointer; color:#999; }
.modal-close:hover { color:#333; }
.modal-body { padding:20px; }
.modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:16px 20px; border-top:1px solid #eee; }
.form-group { margin-bottom:16px; }
.form-group label { display:block; margin-bottom:6px; font-size:14px; color:#333; font-weight:500; }
.form-group input, .form-group select { width:100%; padding:8px 12px; border:1px solid #ddd; border-radius:4px; font-size:14px; box-sizing:border-box; }
.required { color:#e74c3c; }
.modal-sm .modal-content { width:340px; }
.btn-danger { background:#e74c3c; color:#fff; }
.btn-danger:hover { background:#c0392b; }
`;
document.head.insertAdjacentHTML('beforeend', `<style>${modalStyle}</style>`);
```

- [ ] **Step 3: 改造 renderEmployees 函数**

用以下新版本替换 `app.js` 中 `renderEmployees()` 的实现：

```javascript
async function renderEmployees(el) {
    let data = [];
    try { data = await API.employees.list(); } catch (e) { /* mock fallback below */ }
    if (data.length === 0) data = [
        { id:1, name:'张三', role:'生产主管', team:'A班', phone:'13800138001', status:1 },
        { id:2, name:'李四', role:'操作工', team:'A班', phone:'13800138002', status:1 },
        { id:3, name:'王五', role:'技术员', team:'B班', phone:'13800138003', status:1 },
        { id:4, name:'赵六', role:'质检员', team:'A班', phone:'13800138004', status:1 },
        { id:5, name:'孙七', role:'操作工', team:'B班', phone:'13800138005', status:0 },
        { id:6, name:'周八', role:'维修工', team:'维修组', phone:'13800138006', status:2 },
    ];

    el.innerHTML = `
        <div class="page-header">
            <div>
                <h1>人员管理</h1>
                <div class="subtitle">员工信息与排班管理</div>
            </div>
            <button class="btn btn-primary" onclick="App.openEmployeeModal()"><i class="fas fa-plus"></i> 添加人员</button>
        </div>
        <div class="card">
            <div class="table-container">
                <table>
                    <thead><tr>
                        <th>姓名</th><th>角色</th><th>班组</th><th>联系方式</th><th>状态</th><th>操作</th>
                    </tr></thead>
                    <tbody>
                        ${data.map(e => `
                            <tr data-id="${e.id}">
                                <td><strong>${e.name}</strong></td>
                                <td>${e.role}</td>
                                <td>${e.team || '-'}</td>
                                <td>${e.phone || '-'}</td>
                                <td>${e.status === 1 ? '<span class="badge badge-green">在岗</span>' :
                                    e.status === 0 ? '<span class="badge badge-gray">离线</span>' :
                                    '<span class="badge badge-orange">休假</span>'}</td>
                                <td>
                                    <button class="btn-icon" onclick="App.openEmployeeModal(${e.id})" title="编辑"><i class="fas fa-edit"></i></button>
                                    <button class="btn-icon btn-icon-danger" onclick="App.openDeleteModal(${e.id}, '${e.name}')" title="删除"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Modal control functions
window.App.openEmployeeModal = function(id) {
    const modal = document.getElementById('employeeModal');
    const title = document.getElementById('employeeModalTitle');
    if (id) {
        title.textContent = '编辑员工';
        const row = document.querySelector(`tr[data-id="${id}"]`);
        document.getElementById('employeeId').value = id;
        document.getElementById('employeeName').value = row.children[0].textContent.trim();
        document.getElementById('employeeRole').value = row.children[1].textContent.trim();
        document.getElementById('employeeTeam').value = row.children[2].textContent.trim() === '-' ? '' : row.children[2].textContent.trim();
        document.getElementById('employeePhone').value = row.children[3].textContent.trim() === '-' ? '' : row.children[3].textContent.trim();
        const statusText = row.children[4].textContent.trim();
        document.getElementById('employeeStatus').value = statusText.includes('在岗') ? 1 : statusText.includes('休假') ? 2 : 0;
    } else {
        title.textContent = '添加员工';
        document.getElementById('employeeId').value = '';
        document.getElementById('employeeName').value = '';
        document.getElementById('employeeRole').value = '';
        document.getElementById('employeeTeam').value = '';
        document.getElementById('employeePhone').value = '';
        document.getElementById('employeeStatus').value = '1';
    }
    modal.style.display = 'flex';
};

window.App.closeEmployeeModal = function() {
    document.getElementById('employeeModal').style.display = 'none';
};

window.App.saveEmployee = async function() {
    const id = document.getElementById('employeeId').value;
    const data = {
        name: document.getElementById('employeeName').value,
        role: document.getElementById('employeeRole').value,
        team: document.getElementById('employeeTeam').value,
        phone: document.getElementById('employeePhone').value,
        status: parseInt(document.getElementById('employeeStatus').value),
    };

    if (!data.name.trim()) { alert('姓名不能为空'); return; }
    if (!data.role.trim()) { alert('角色不能为空'); return; }

    try {
        if (id) {
            await API.employees.update(parseInt(id), data);
        } else {
            await API.employees.create(data);
        }
        App.closeEmployeeModal();
        App.navigate('employees');
    } catch (e) {
        alert(e.message || '保存失败');
    }
};

window.App.openDeleteModal = function(id, name) {
    document.getElementById('deleteEmployeeName').textContent = name;
    document.getElementById('deleteModal').dataset.id = id;
    document.getElementById('deleteModal').style.display = 'flex';
};

window.App.closeDeleteModal = function() {
    document.getElementById('deleteModal').style.display = 'none';
};

window.App.confirmDelete = async function() {
    const id = document.getElementById('deleteModal').dataset.id;
    try {
        await API.employees.remove(parseInt(id));
        App.closeDeleteModal();
        App.navigate('employees');
    } catch (e) {
        alert(e.message || '删除失败');
    }
};
```

- [ ] **Step 4: 添加 btn-icon 样式**

在 `app.js` 顶部的 `modalStyle` 中追加按钮样式：

```javascript
.btn-icon { background:none; border:none; cursor:pointer; padding:4px 8px; color:#666; font-size:14px; }
.btn-icon:hover { color:#2D8C5A; }
.btn-icon-danger:hover { color:#e74c3c; }
```

- [ ] **Step 5: 提交**

```bash
git add frontend/index.html frontend/js/app.js
git commit -m "feat(employee): add CRUD UI with modal forms"
```

---

## Task 5: 验证

- [ ] **Step 1: 启动后端服务**

```bash
cd backend && python main.py
```

- [ ] **Step 2: 测试 API**

```bash
# 列出所有员工
curl http://localhost:8000/api/employees

# 新增员工
curl -X POST http://localhost:8000/api/employees \
  -H "Content-Type: application/json" \
  -d '{"name":"测试员工","role":"操作工","team":"C班","phone":"13900001111","status":1}'

# 获取单个员工（把 {id} 换成实际ID）
curl http://localhost:8000/api/employees/{id}

# 更新员工
curl -X PUT http://localhost:8000/api/employees/{id} \
  -H "Content-Type: application/json" \
  -d '{"name":"测试员工","role":"技术员","team":"C班","phone":"13900001111","status":1}'

# 删除员工
curl -X DELETE http://localhost:8000/api/employees/{id}
```

- [ ] **Step 3: 浏览器验证**

1. 启动后端后，在浏览器打开 `http://localhost:8000`
2. 进入「人员管理」页面
3. 点击「添加人员」测试添加功能
4. 点击编辑按钮测试编辑功能
5. 点击删除按钮测试删除功能