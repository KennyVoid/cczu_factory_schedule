"""
ALNS 排产系统 - FastAPI 后端
提供配置管理、文件上传、启动优化、结果下载等接口
"""
import os
import sys
import threading
import tempfile
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import AlnsScheduleConfig
from optimizer import OptimizerEngine

app = FastAPI(title="ALNS 智能排程系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 存储运行中的任务
tasks: dict[str, OptimizerEngine] = {}

UPLOAD_DIR = Path(tempfile.gettempdir()) / "alns_uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


@app.get("/api/config/default")
def get_default_config():
    """获取默认配置"""
    config = AlnsScheduleConfig()
    return JSONResponse(config.model_dump())


@app.post("/api/config/validate")
def validate_config(config: AlnsScheduleConfig):
    """验证配置是否有效"""
    return JSONResponse({"valid": True, "config": config.model_dump()})


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """上传Excel/CSV文件"""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(400, "仅支持 .xlsx / .xls / .csv 格式")
    task_id = str(uuid.uuid4())[:8]
    ext = os.path.splitext(file.filename)[1]
    save_path = UPLOAD_DIR / f"{task_id}{ext}"
    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)
    return {"task_id": task_id, "filename": file.filename, "path": str(save_path)}


@app.post("/api/optimize/start")
def start_optimize(
    task_id: str = Form(...),
    config_json: Optional[str] = Form(None),
):
    """启动优化任务（异步）"""
    file_candidates = list(UPLOAD_DIR.glob(f"{task_id}.*"))
    if not file_candidates:
        raise HTTPException(404, f"未找到 task_id={task_id} 的上传文件")
    file_path = str(file_candidates[0])

    if config_json:
        config = AlnsScheduleConfig.model_validate_json(config_json)
    else:
        config = AlnsScheduleConfig()

    engine = OptimizerEngine(config)

    def run_in_thread():
        try:
            engine.run(file_path)
        except Exception:
            pass

    t = threading.Thread(target=run_in_thread, daemon=True)
    t.start()
    tasks[task_id] = engine

    return {"task_id": task_id, "status": "started", "message": "优化任务已启动"}


@app.get("/api/optimize/status/{task_id}")
def get_status(task_id: str):
    """查询优化任务状态"""
    engine = tasks.get(task_id)
    if not engine:
        raise HTTPException(404, f"未找到任务 {task_id}")
    resp = {
        "status": engine.status,
        "progress": engine.progress,
        "message": engine.message,
    }
    if engine.status == "completed":
        resp["score"] = engine.score
        resp["objective_detail"] = engine.objective_detail
        resp["result_path"] = f"/api/optimize/download/{task_id}"
    if engine.status == "error":
        resp["error"] = engine.error
    return JSONResponse(resp)


@app.get("/api/optimize/download/{task_id}")
def download_result(task_id: str):
    """下载优化结果CSV"""
    engine = tasks.get(task_id)
    if not engine or not engine.result_path or not os.path.exists(engine.result_path):
        raise HTTPException(404, "结果文件不存在")
    return FileResponse(
        engine.result_path,
        media_type="text/csv",
        filename=f"schedule_result_{task_id}.csv",
        headers={"Content-Disposition": f'attachment; filename="schedule_result_{task_id}.csv"'}
    )


@app.get("/api/tasks")
def list_tasks():
    """列出所有任务及其状态"""
    return {
        task_id: {
            "status": engine.status,
            "progress": engine.progress,
            "message": engine.message,
        }
        for task_id, engine in tasks.items()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)