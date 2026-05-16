"""
设备制造排程系统 - 可配置参数模型
所有参数均可通过 API 调整，以实现不同工厂的适配。
"""

from pydantic import BaseModel
from typing import List, Dict, Optional


class ProcessDefinition(BaseModel):
    """工艺分类定义"""
    special_processes: List[str] = [
        '阳极氧化红', '阳极氧化蓝', '镀铬处理', '喷砂处理',
        '激光刻字', '电泳黑', '纳米涂层', '高温烤漆',
        '真空镀膜', '钝化处理', '磷化处理', '发蓝处理',
        '达克罗', '特氟龙', '渗碳处理', '氮化处理',
        '抛光处理', '拉丝处理'
    ]
    standard_processes: List[str] = [
        '标准喷涂灰', '标准喷涂白', '标准喷涂黑', '标准喷涂银',
        '防锈处理', '底漆处理', '面漆处理', '清漆处理',
        '粉末喷涂', '氟碳喷涂'
    ]


class BatchLimit(BaseModel):
    """批次约束: [下限, 上限]"""
    special_process: List[int] = [15, 30]
    dual_process: List[int] = [1, 4]
    standard_process: List[int] = [15, 9999]
    special_component: List[int] = [1, 1]


class GapLimit(BaseModel):
    """间隔约束: 特殊属性之后的最小间隔数"""
    special_process: int = 60
    dual_process: int = 60
    special_component: int = 30


class ObjectiveWeights(BaseModel):
    """目标函数权重/归一化基准"""
    switch: Dict[str, float] = {
        "设备型号": 383.0,
        "选装件": 606.0,
        "表面处理BAK": 1906.0,
        "设备等级": 1395.0,
        "组件特征": 1613.0
    }
    gap: Dict[str, float] = {
        "特种工艺": 0.398,
        "双工序": 0.558,
        "特殊组件": 1.0
    }
    num: Dict[str, float] = {
        "特种工艺": 0.226,
        "双工序": 1.0,
        "标准工艺": 0.467,
        "特殊组件": 1.0
    }


class OptimizerParams(BaseModel):
    """优化器参数"""
    max_time_hours: int = 24
    early_stop_count: int = 10
    split_base: int = 60
    max_parallel: int = 60
    split_divisor_ceiling: int = 60


class AlnsScheduleConfig(BaseModel):
    """完整配置模型 - 可序列化为JSON供前端编辑"""
    attributes: List[str] = [
        '计划日期', '设备型号', '选装件', '表面处理BAK', '标准工艺',
        '双工序', '特种工艺', '特殊组件', '设备等级', '组件特征'
    ]
    process_definition: ProcessDefinition = ProcessDefinition()
    batch_limit: BatchLimit = BatchLimit()
    gap_limit: GapLimit = GapLimit()
    objective_weights: ObjectiveWeights = ObjectiveWeights()
    optimizer: OptimizerParams = OptimizerParams()

    def to_batch_limit_dict(self) -> Dict[str, List[int]]:
        return {
            '特种工艺': self.batch_limit.special_process,
            '双工序': self.batch_limit.dual_process,
            '标准工艺': self.batch_limit.standard_process,
            '特殊组件': self.batch_limit.special_component,
        }

    def to_gap_limit_dict(self) -> Dict[str, int]:
        return {
            '特种工艺': self.gap_limit.special_process,
            '双工序': self.gap_limit.dual_process,
            '特殊组件': self.gap_limit.special_component,
        }

    def to_objective_artificial(self) -> Dict:
        return {
            'switch': self.objective_weights.switch,
            'gap': self.objective_weights.gap,
            'num': self.objective_weights.num,
        }