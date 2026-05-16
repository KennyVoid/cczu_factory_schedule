"""
Simplified ALNS scheduler - factory production scheduling optimizer
"""
import json
import random
from itertools import groupby
from database import query

# Map Chinese constraint names to actual order/product field names
CONSTRAINT_FIELD_MAP = {
    '属性A': 'attr_a',
    '属性B': 'attr_b',
    '复合工艺': 'composite_craft',
    '特殊组件': 'special_component',
}

DEFAULT_VALUES = {"", "无", "other", "none"}


class SimplifiedALNS:
    """Simplified ALNS scheduler (demo)"""

    def __init__(self, order_ids=None):
        self.orders = self._load_orders(order_ids)
        constraints = self._load_constraints()
        self.batch_limit = {}
        self.gap_limit = {}
        for c in constraints:
            field = CONSTRAINT_FIELD_MAP.get(c["constraint_name"])
            if not field:
                continue
            self.batch_limit[field] = [c["min_batch"], c["max_batch"]]
            if c["gap_limit"] > 0:
                self.gap_limit[field] = c["gap_limit"]

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

    @staticmethod
    def _load_constraints():
        return query("SELECT * FROM constraint_config WHERE is_active = 1")

    @staticmethod
    def switch_count(sequence, attr):
        """Count value switches between adjacent orders"""
        count = 0
        for i in range(len(sequence) - 1):
            if sequence[i][attr] != sequence[i + 1][attr]:
                count += 1
        return count

    def batch_quality(self, sequence, field):
        """
        Rate of batches that meet size constraints.
        A batch = consecutive orders with the same field value.
        """
        if not sequence:
            return 1.0
        low, up = self.batch_limit.get(field, [1, 9999])
        n_true = n_false = 0
        for k, g in groupby(sequence, key=lambda x: x.get(field, "")):
            if k and k not in DEFAULT_VALUES:
                batch_size = sum(1 for _ in g)
                if low <= batch_size <= up:
                    n_true += 1
                else:
                    n_false += 1
        total = n_true + n_false
        return n_true / total if total > 0 else 1.0

    def gap_quality(self, sequence, field):
        """
        Rate of adequate gaps between consecutive non-default values.
        A gap = number of orders between two non-default occurrences.
        gap >= limit -> qualified (enough distance between special items)
        """
        limit = self.gap_limit.get(field)
        if not limit or len(sequence) < 2:
            return 1.0
        good = bad = 0
        last_pos = None
        for i, order in enumerate(sequence):
            val = order.get(field, "")
            if val and val not in DEFAULT_VALUES:
                if last_pos is not None:
                    gap = i - last_pos - 1
                    if gap >= limit:
                        good += 1
                    else:
                        bad += 1
                last_pos = i
        total = good + bad
        return good / total if total > 0 else 1.0

    def compute_score(self, sequence):
        """
        Score a schedule sequence. Lower is better.
        Factors: switch count, batch quality, gap quality.
        """
        switch_fields = ["attr_a", "attr_b", "composite_craft", "special_component"]
        batch_fields = list(self.batch_limit.keys())
        gap_fields = list(self.gap_limit.keys())

        total_switch = sum(self.switch_count(sequence, f) for f in switch_fields)

        batch_rates = [self.batch_quality(sequence, f) for f in batch_fields]
        avg_batch = sum(batch_rates) / len(batch_rates) if batch_rates else 1.0

        gap_rates = [self.gap_quality(sequence, f) for f in gap_fields]
        avg_gap = sum(gap_rates) / len(gap_rates) if gap_rates else 1.0

        score = total_switch * 0.4 + (1 - avg_batch) * 30 + (1 - avg_gap) * 20
        return score, total_switch, avg_batch, avg_gap

    @staticmethod
    def _compute_batch_ids(sequence):
        """
        Assign batch IDs iteratively.
        Same (attr_a, attr_b) = same batch; changes increment batch ID.
        """
        if not sequence:
            return []
        batch_ids = [1]
        for i in range(1, len(sequence)):
            prev = sequence[i - 1]
            curr = sequence[i]
            if (prev.get("attr_a") == curr.get("attr_a") and
                    prev.get("attr_b") == curr.get("attr_b")):
                batch_ids.append(batch_ids[-1])
            else:
                batch_ids.append(batch_ids[-1] + 1)
        return batch_ids

    def optimize(self):
        """Run ALNS optimization."""
        if not self.orders:
            return None

        random.seed(42)
        seq = list(self.orders)

        # Cluster: same attr_a together, within that by attr_b, then by priority
        seq.sort(key=lambda x: (
            x.get("attr_a", ""),
            x.get("attr_b", ""),
            x["priority"],
        ))

        best_seq = list(seq)
        best_score, best_switch, best_batch, best_gap = self.compute_score(best_seq)

        for iteration in range(50):
            new_seq = list(best_seq)
            op = random.randint(0, 3)

            if op == 0 and len(new_seq) >= 2:
                # 2-opt: reverse a segment
                i = random.randint(0, len(new_seq) - 2)
                j = random.randint(i + 1, len(new_seq) - 1)
                new_seq[i:j + 1] = reversed(new_seq[i:j + 1])

            elif op == 1 and len(new_seq) >= 3:
                # Relocation: move one item to another position
                i = random.randint(0, len(new_seq) - 1)
                j = random.randint(0, len(new_seq) - 1)
                if i != j:
                    item = new_seq.pop(i)
                    new_seq.insert(j, item)

            elif op == 2 and len(new_seq) >= 4:
                # Exchange: swap two items
                i = random.randint(0, len(new_seq) - 1)
                j = random.randint(0, len(new_seq) - 1)
                if i != j:
                    new_seq[i], new_seq[j] = new_seq[j], new_seq[i]

            else:
                # Recluster by attr_a
                new_seq.sort(key=lambda x: (
                    x.get("attr_a", ""),
                    x.get("attr_b", ""),
                    x["priority"],
                ))

            score, switch, batch, gap = self.compute_score(new_seq)
            if score < best_score or (iteration > 20 and random.random() < 0.1):
                best_seq = list(new_seq)
                best_score = score
                best_switch = switch
                best_batch = batch
                best_gap = gap

        # Baseline: original order sorted by ID
        baseline = sorted(self.orders, key=lambda x: x["id"])
        _, before_switch, before_batch, before_gap = self.compute_score(baseline)

        batch_ids = self._compute_batch_ids(best_seq)

        return {
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
                    "batch_id": batch_ids[i],
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
