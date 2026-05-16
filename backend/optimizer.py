"""
简化版 ALNS 排产优化器
基于 demo.py 的算法框架，适配通用制造术语，返回演示排产结果
"""
import json
import random
import math
from itertools import groupby
from database import query


class SimplifiedALNS:
    """简化版 ALNS 排产优化器（演示用）"""

    def __init__(self, order_ids=None):
        self.orders = self._load_orders(order_ids)
        self.constraints = self._load_constraints()
        self.batch_limit = {}
        self.gap_limit = {}
        for c in self.constraints:
            key = c["constraint_name"]
            self.batch_limit[key] = [c["min_batch"], c["max_batch"]]
            if c["gap_limit"] > 0:
                self.gap_limit[key] = c["gap_limit"]

    def _load_orders(self, order_ids):
        if order_ids:
            placeholders = ",".join("?" for _ in order_ids)
            rows = query(f"SELECT o.*, p.name as product_name, p.attr_a, p.attr_b, "
                         f"p.composite_craft, p.special_component, p.model_type, "
                         f"p.craft_type, p.appearance_spec "
                         f"FROM \"order\" o JOIN product p ON o.product_id = p.id "
                         f"WHERE o.id IN ({placeholders})", order_ids)
        else:
            rows = query("SELECT o.*, p.name as product_name, p.attr_a, p.attr_b, "
                         f"p.composite_craft, p.special_component, p.model_type, "
                         f"p.craft_type, p.appearance_spec "
                         f"FROM \"order\" o JOIN product p ON o.product_id = p.id "
                         f"WHERE o.status = 0 ORDER BY o.priority, o.deadline")
        return rows

    def _load_constraints(self):
        return query("SELECT * FROM constraint_config WHERE is_active = 1")

    def switch_count(self, sequence, attr):
        """计算相邻订单间的属性切换次数"""
        count = 0
        for i in range(len(sequence) - 1):
            if sequence[i][attr] != sequence[i + 1][attr]:
                count += 1
        return count

    def batch_quality(self, sequence, attr):
        """计算批次合格率"""
        if not sequence:
            return 1.0
        low, up = self.batch_limit.get(attr, [1, 9999])
        n_true, n_false = 0, 0
        for k, g in groupby(sequence, key=lambda x: x.get(attr, "")):
            if k and k != "" and k != "无":
                batch_size = sum(1 for _ in g)
                if low <= batch_size <= up:
                    n_true += 1
                else:
                    n_false += 1
        total = n_true + n_false
        return n_true / total if total > 0 else 1.0

    def gap_quality(self, sequence, attr):
        """计算间隔合格率"""
        if not sequence or attr not in self.gap_limit:
            return 1.0
        limit = self.gap_limit[attr]
        n_true, n_false = 0, 0
        other_count = 0
        for k, g in groupby(sequence, key=lambda x: x.get(attr, "")):
            g_size = sum(1 for _ in g)
            if k == "" or k == "other":
                if g_size >= limit:
                    n_true += 1
                else:
                    n_false += 1
            else:
                n_true += 1
        total = n_true + n_false
        return n_true / total if total > 0 else 1.0

    def compute_score(self, sequence):
        """
        计算排产方案得分
        得分越低越好，综合考虑：切换次数、批次合格率、间隔合格率
        """
        attrs_switch = ["attr_a", "attr_b", "composite_craft", "special_component"]
        attrs_batch = list(self.batch_limit.keys())

        total_switch = sum(self.switch_count(sequence, a) for a in attrs_switch)
        batch_rates = [self.batch_quality(sequence, a) for a in attrs_batch]
        avg_batch_rate = sum(batch_rates) / len(batch_rates) if batch_rates else 1.0
        gap_rates = [self.gap_quality(sequence, a) for a in self.gap_limit]
        avg_gap_rate = sum(gap_rates) / len(gap_rates) if gap_rates else 1.0

        score = total_switch * 0.4 + (1 - avg_batch_rate) * 30 + (1 - avg_gap_rate) * 20
        return score, total_switch, avg_batch_rate, avg_gap_rate

    def optimize(self):
        """执行模拟优化，生成演示排产结果"""
        if not self.orders:
            return None

        random.seed(42)
        seq = list(self.orders)

        # 排序：按优先级、按属性A聚类
        seq.sort(key=lambda x: (x["priority"], x.get("attr_a", ""), x.get("attr_b", "")))

        # 模拟 ALNS 迭代优化过程
        best_seq = list(seq)
        best_score, best_switch, best_batch, best_gap = self.compute_score(best_seq)

        for iteration in range(50):
            new_seq = list(best_seq)
            op = random.randint(0, 3)

            if op == 0 and len(new_seq) >= 2:
                # 2-opt
                i = random.randint(0, len(new_seq) - 2)
                j = random.randint(i + 1, len(new_seq) - 1)
                new_seq[i:j + 1] = reversed(new_seq[i:j + 1])

            elif op == 1 and len(new_seq) >= 3:
                # 移位
                i = random.randint(0, len(new_seq) - 1)
                j = random.randint(0, len(new_seq) - 1)
                if i != j:
                    item = new_seq.pop(i)
                    new_seq.insert(j, item)

            elif op == 2 and len(new_seq) >= 4:
                # 交换
                i = random.randint(0, len(new_seq) - 1)
                j = random.randint(0, len(new_seq) - 1)
                if i != j:
                    new_seq[i], new_seq[j] = new_seq[j], new_seq[i]

            else:
                # 按属性A重聚类
                new_seq.sort(key=lambda x: (x.get("attr_a", ""), x.get("attr_b", "")))

            score, switch, batch, gap = self.compute_score(new_seq)
            if score < best_score or (iteration > 20 and random.random() < 0.1):
                # 接受更好的解，或在后期有一定概率接受较差解（模拟退火）
                best_seq = list(new_seq)
                best_score = score
                best_switch = switch
                best_batch = batch
                best_gap = gap

        # 计算优化前指标（按ID排序作为baseline）
        baseline = list(self.orders)
        baseline.sort(key=lambda x: x["id"])
        _, before_switch, before_batch, before_gap = self.compute_score(baseline)

        result = {
            "order_sequence": [o["id"] for o in best_seq],
            "sequence_detail": [
                {
                    "order_id": o["id"],
                    "order_no": o["order_no"],
                    "product_name": o["product_name"],
                    "attr_a": o["attr_a"],
                    "attr_b": o["attr_b"],
                    "composite_craft": o["composite_craft"],
                    "special_component": o["special_component"],
                    "quantity": o["quantity"],
                    "priority": o["priority"],
                    "deadline": o["deadline"],
                    "batch_id": self._assign_batch(best_seq, i)
                }
                for i, o in enumerate(best_seq)
            ],
            "before": {
                "switch_count": before_switch,
                "batch_rate": round(before_batch * 100, 2),
                "gap_rate": round(before_gap * 100, 2),
                "score": round(self.compute_score(baseline)[0], 2),
            },
            "after": {
                "switch_count": best_switch,
                "batch_rate": round(best_batch * 100, 2),
                "gap_rate": round(best_gap * 100, 2),
                "score": round(best_score, 2),
            },
        }
        return result

    def _assign_batch(self, sequence, idx):
        """分配批次号"""
        if idx == 0:
            return 1
        prev = sequence[idx - 1]
        curr = sequence[idx]
        if (prev.get("attr_a") == curr.get("attr_a") and
                prev.get("attr_b") == curr.get("attr_b")):
            return self._assign_batch(sequence, idx - 1) + 0  # same batch
        # Check prev batch id
        return idx + 1

    @staticmethod
    def generate_mock_result():
        """生成演示用的硬编码排产结果"""
        orders = query("SELECT o.*, p.name as product_name, p.attr_a, p.attr_b, "
                       "p.composite_craft, p.special_component "
                       f"FROM \"order\" o JOIN product p ON o.product_id = p.id LIMIT 10")

        seq = list(orders)
        random.seed(42)
        random.shuffle(seq)
        seq.sort(key=lambda x: (x["priority"], x.get("attr_a", "")))

        return {
            "order_sequence": [o["id"] for o in seq],
            "sequence_detail": [
                {
                    "order_id": o["id"],
                    "order_no": o["order_no"],
                    "product_name": o["product_name"],
                    "attr_a": o["attr_a"],
                    "attr_b": o["attr_b"],
                    "composite_craft": o["composite_craft"],
                    "special_component": o["special_component"],
                    "quantity": o["quantity"],
                    "priority": o["priority"],
                    "deadline": o["deadline"],
                    "batch_id": (i // 3) + 1
                }
                for i, o in enumerate(seq)
            ],
            "before": {
                "switch_count": 32,
                "batch_rate": 45.8,
                "gap_rate": 62.3,
                "score": 28.45,
            },
            "after": {
                "switch_count": 14,
                "batch_rate": 82.5,
                "gap_rate": 91.7,
                "score": 11.23,
            },
        }
