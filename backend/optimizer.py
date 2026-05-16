"""
ALNS 优化器引擎 - 可配置化重构版本
从 demo.py 提取核心逻辑，支持通过配置对象注入参数
脱敏：汽车排产 → 设备制造排程
"""
import os
import sys
import time
import datetime
import pandas as pd
import numpy as np
from itertools import groupby, permutations, filterfalse
from random import shuffle, seed
import cardinality
from cacheout import Cache

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import AlnsScheduleConfig

seed(0)

ST = time.time()
_stat_cache = Cache(maxsize=9999)


def flatten(nested_list):
    result = []
    for sublist in nested_list:
        if isinstance(sublist, list):
            result.extend(flatten(sublist))
        else:
            result.append(sublist)
    return result


def unique_by_first_last(lst):
    arr = np.array(lst)
    unique_indices = np.unique(arr[:, [0, -1]], axis=0, return_index=True)[1]
    unique_items = arr[unique_indices]
    return unique_items.tolist()


class ALNS:
    """自适应大邻域搜索优化器 - 核心算法"""

    def __init__(self, df, config: AlnsScheduleConfig):
        self.config = config
        self.special_processes = config.process_definition.special_processes
        self.standard_processes = config.process_definition.standard_processes
        self.attribute = config.attributes + ["split"]
        self.batch_limit = config.to_batch_limit_dict()
        self.gap_limit = config.to_gap_limit_dict()
        self.objective_artificial = config.to_objective_artificial()

        df = df.sort_values(by=["计划日期", "生产订单号"]).reset_index(drop=True)
        self.df = df
        self.group, self.data = {}, {}
        self.model_path = self.init_model_path()
        self.path, self.score = self.generate_path()
        self.early_stop = np.zeros(len(self.path)) + 1
        self.logs = []

    def init_model_path(self):
        """初始化设备型号顺序（最小化切换）"""
        model_params = self.df.groupby('计划日期')['设备型号'].unique().to_list()
        model_params = [list(x) for x in model_params]
        n_length = sum([len(x) for x in model_params])
        path = [[] for _ in model_params]
        while sum([len(_) for _ in path]) < n_length:
            paths = []
            score = []
            for date_id, model_list in enumerate(model_params):
                for p in model_list:
                    if p in path[date_id]:
                        continue
                    for j in range(len(path[date_id]) + 1):
                        path_ = path[:date_id] + [path[date_id][:j] + [p] + path[date_id][j:]] + path[date_id + 1:]
                        paths.append(path_)
                        score.append([len(list(groupby(flatten(path_)))), len(path[date_id])])
            out = sorted(zip(score, paths))
            out = list(filterfalse(lambda x: x[0] != out[-1][0], out))
            shuffle(out)
            score, path = out[0]
        early_stop = 0
        while True:
            score_before = len(list(groupby(flatten(path))))
            for i in range(len(path)):
                paths = [path[:i] + [list(_)] + path[i + 1:] for _ in unique_by_first_last(list(permutations(path[i])))]
                shuffle(paths)
                score = [len(list(groupby(flatten(raw_list)))) for raw_list in paths]
                path = paths[score.index(min(score))]
            for i in range(len(path) - 2):
                paths = []
                xx = unique_by_first_last(list(permutations(path[i])))
                yy = unique_by_first_last(list(permutations(path[i + 1])))
                for x in xx:
                    for y in yy:
                        if x[-1] == y[0]:
                            paths.append(path[:i] + [list(x)] + [list(y)] + path[i + 2:])
                shuffle(paths)
                score = [len(list(groupby(flatten(raw_list)))) for raw_list in paths]
                path = paths[score.index(min(score))]
            score_after = len(list(groupby(flatten(path))))
            if score_before == score_after:
                early_stop += 1
                if early_stop == 10:
                    break
            else:
                early_stop = 1
        return path

    def generate_path(self):
        df = self.df.groupby(self.attribute, as_index=False)["num"].sum()
        for var in self.attribute:
            self.group[var] = np.array(df[var])
            self.data[var] = np.array(df[[var, "num"]])
        path_dict = {date: {} for date in df["计划日期"].unique()}
        for (date, model), g_data in df.groupby(["计划日期", "设备型号"]):
            path_dict[date][model] = g_data.index.tolist()
        path = [[path_dict[date][model] for model in self.model_path[date_id]] for date_id, date in enumerate(path_dict)]
        score = self.statistic(path)
        return path, score

    def switch_num(self, path, name):
        return cardinality.count(groupby(self.group[name][path])) - 1

    def batch_num(self, path, name):
        low, up = self.batch_limit[name]
        n_true, n_false = 0, 0
        for k, g in groupby(self.data[name][path], key=lambda x: x[0]):
            if k != "other":
                batch_num = sum([v[1] for v in g])
                if (batch_num >= low) & (batch_num <= up):
                    n_true += 1
                else:
                    n_false += 1
        n_total = n_true + n_false
        if n_total == 0:
            return 1
        else:
            return n_true / n_total

    def batch_gap(self, path, name):
        batch_name = "other"
        n_true, n_false = 0, 0
        for k, g in groupby(self.data[name][path], key=lambda x: x[0]):
            if k == "other":
                if sum(v[1] for v in g) >= self.gap_limit[name]:
                    n_true += 1
                else:
                    n_false += 1
            else:
                if batch_name != "other":
                    n_false += 1
            batch_name = k
        n_total = n_true + n_false
        if n_total == 0:
            return 1
        else:
            return n_true / n_total

    @_stat_cache.memoize()
    def statistic(self, path):
        objective = self.objective(path)
        x = [objective["gap"]['双工序'], objective["gap"]['特殊组件']] + list(objective["num"].values())
        for k1 in objective:
            for k2 in objective[k1]:
                if k1 == 'switch':
                    objective[k1][k2] = 1 - objective[k1][k2] / self.objective_artificial[k1][k2]
                else:
                    objective[k1][k2] = objective[k1][k2] / self.objective_artificial[k1][k2] - 1
        return [objective["switch"]["设备型号"],
                np.minimum(np.min(x), 0.5),
                4 * objective["switch"]["选装件"] + 2 * objective["switch"]["表面处理BAK"] +
                objective["gap"]['双工序'] + objective["gap"]['特殊组件'] +
                sum(objective["num"].values()), np.minimum(objective["gap"]['特种工艺'], 0.5),
                objective["switch"]["设备等级"] + objective["switch"]["组件特征"] + objective["gap"]['特种工艺']]

    def objective(self, path):
        path = flatten(path)
        switch = {key: self.switch_num(path, key) for key in
                  ['设备型号', '选装件', '表面处理BAK', '设备等级', '组件特征']}
        gap, num = {}, {}
        for key in ['特种工艺', '双工序', '标准工艺', '特殊组件']:
            num[key] = self.batch_num(path, key)
        for key in ['特种工艺', '双工序', '特殊组件']:
            gap[key] = self.batch_gap(path, key)
        return {"switch": switch, "gap": gap, "num": num}

    def local_search(self, date_id, model_id):
        path = [0] + self.path[date_id][model_id] + [0]
        n = len(path)
        paths = [path]
        method = np.random.randint(0, 4, 1)
        if method == 0:
            for i in range(0, n - 1):
                for j in range(i + 1, n - 1):
                    paths.append(path[:i + 1] + path[j:i:-1] + path[j + 1:])
        elif method == 1:
            for i in range(1, n - 1):
                for j in range(i + 1, n - 1):
                    paths.append([path[0]] + [path[i]] + path[1:i] + path[i + 1:j] + path[j + 1:-1] + [path[j]] + [path[-1]])
                    paths.append([path[0]] + [path[j]] + path[1:i] + path[i + 1:j] + path[j + 1:-1] + [path[i]] + [path[-1]])
        elif method == 2:
            for i in range(1, n - 1):
                for k in range(0, min(n - i - 2, 20)):
                    for j in range(i + 1 + k, n):
                        if (i == j) or (j == i - 1):
                            continue
                        if i < j:
                            paths.append(path[:i] + path[i + 1 + k:j] + path[i:i + 1 + k] + path[j:])
                        else:
                            paths.append(path[:j] + path[i:i + 1 + k] + path[j:i] + path[i + 1 + k:])
        else:
            for i in range(1, n - 1):
                for k in range(0, min(n - i - 2, 20)):
                    for j in range(i + k + 1, n - k - 1):
                        if i == j:
                            continue
                        paths.append(path[:i] + path[j:j + k + 1] + path[i + k + 1:j] + path[i:i + k + 1] + path[j + k + 1:])
        paths = list(set(tuple(path) for path in paths))
        paths = [self.path[:date_id] + [self.path[date_id][:model_id] + [list(path[1:-1])] + self.path[date_id][model_id + 1:]] + self.path[date_id + 1:] for path in paths]
        return paths

    def optimize(self):
        for date_id, date in enumerate(self.path):
            if self.early_stop[date_id] == 5:
                continue
            paths = []
            for model_id, _ in enumerate(self.path[date_id]):
                if len(self.path[date_id][model_id]) > 1:
                    paths.extend(self.local_search(date_id, model_id))
            n_model = len(self.path[date_id])
            for model_path in list(permutations(range(n_model))):
                path_ = [self.path[date_id][model_id] for model_id in model_path]
                path_ = self.path[:date_id] + [path_] + self.path[date_id + 1:]
                paths.append(path_)
            for i in range(n_model - 2):
                for j in range(i + 2, n_model):
                    path_opt = self.path[date_id][:i] + [_[::-1] for _ in self.path[date_id][i:j][::-1]] + self.path[date_id][j:]
                    path_opt = self.path[:date_id] + [path_opt] + self.path[date_id + 1:]
                    paths.append(path_opt)
            score = [self.statistic(path) for path in paths]
            out = sorted(zip(score, paths))
            out = list(filterfalse(lambda x: x[0] != out[-1][0], out))
            out_select = list(filterfalse(lambda x: x[1] == self.path, out))
            if out_select:
                out = out_select
            shuffle(out)
            if self.objective(out[-1][1][date_id]) == self.objective(self.path[date_id]):
                self.early_stop[date_id] += 1
            else:
                self.early_stop[date_id] = 1
            self.score, self.path = out[-1]

    def result(self):
        df_summary = pd.DataFrame(self.group).iloc[flatten(self.path)].reset_index(drop=True)
        df_summary["rank"] = range(len(df_summary))
        df = self.df.merge(df_summary, how="left", left_on=self.attribute, right_on=self.attribute)
        df = df.sort_values(by=["rank", "生产订单号-ERP", '设备等级', '组件特征']).reset_index(drop=True)
        df = df.drop(["rank", "特种工艺", "标准工艺", "双工序", "特殊组件", "表面处理BAK", "split", "num"], axis=1)
        return df


def update_div_dict(config: AlnsScheduleConfig):
    """计算最优除数映射表"""
    batch_limit = config.to_batch_limit_dict()
    split_ceiling = config.optimizer.split_divisor_ceiling
    div_dict = {
        '特种工艺': [30] * 2000,
        '标准工艺': [30] * 2000,
        '双工序': [4] * 2000,
        '特殊组件': [1] * 2000
    }
    for dividend in range(0, 500):
        for col in ['特种工艺', '标准工艺', '双工序']:
            low, up = batch_limit[col]
            divisor_range = np.arange(low, min(up + 1, split_ceiling + 1))
            div, mod = divmod(dividend, divisor_range)
            is_available = np.where((mod == 0) | ((mod >= low) & (mod <= up)), 1, 0)
            div_ceil = div + np.where(mod > 0, 1, 0)
            out = sorted(zip(is_available, div_ceil, mod, divisor_range), key=lambda x: [-x[0], x[1], x[2], -x[3]])
            div_dict[col][dividend] = out[0][-1]
    return div_dict


def prepare_data(file_path: str, config: AlnsScheduleConfig):
    """读取Excel并准备数据"""
    div_dict = update_div_dict(config)
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path, encoding='gbk')
    else:
        df = pd.read_excel(file_path, sheet_name=0)

    # 脱敏：表面处理分类
    df['表面处理BAK'] = df['表面处理'].str.strip('-Y')
    df['特种工艺'] = np.where(df['表面处理'].isin(config.process_definition.special_processes), df['表面处理BAK'], 'other')
    df['标准工艺'] = np.where(df['表面处理'].isin(config.process_definition.standard_processes), df['表面处理BAK'], 'other')
    df['双工序'] = np.where(df['表面处理'].str.contains('/'), df['表面处理BAK'], 'other')
    df["特殊组件"] = np.where(df["组件特征"].str.contains("特殊"), df["组件特征"], "other")

    df = df.sort_values(by=config.attributes).reset_index(drop=True)
    df['num'] = df.groupby(config.attributes)['生产订单号-ERP'].transform('count').values
    df['index'] = df.groupby(config.attributes)['生产订单号-ERP'].transform('rank').values
    df['split'] = np.ceil(df['index'] / config.optimizer.split_base)

    batch_limit = config.to_batch_limit_dict()
    for col in ['标准工艺', '特种工艺', '双工序', '特殊组件']:
        df['split'] = np.where(df[col] != 'other',
                               np.ceil(df['index'] / df['num'].apply(lambda x: div_dict[col][int(x)])),
                               df['split'])
    df['num'] = 1
    return df.drop(['index'], axis=1)


class OptimizerEngine:
    """优化器引擎 - 封装ALNS运行流程"""

    def __init__(self, config: AlnsScheduleConfig = None):
        self.config = config or AlnsScheduleConfig()
        self.status = "idle"
        self.progress = 0
        self.message = ""
        self.result_df = None
        self.result_path = None
        self.score = None
        self.objective_detail = None
        self.error = None
        self._alns = None

    def run(self, file_path: str):
        """运行优化"""
        try:
            self.status = "running"
            self.progress = 0
            self.message = "正在准备数据..."
            self.error = None

            df = prepare_data(file_path, self.config)
            self.progress = 20
            self.message = "数据准备完成，正在初始化ALNS..."

            self._alns = ALNS(df, self.config)
            self.progress = 40
            self.message = "正在优化排程顺序..."

            score_before = self._alns.score
            path_before = self._alns.path
            early_stop = 0
            max_stop = self.config.optimizer.early_stop_count
            iteration = 0

            while True:
                self._alns.optimize()
                iteration += 1
                if self._alns.path == path_before:
                    break
                path_before = self._alns.path
                if self._alns.score == score_before:
                    early_stop += 1
                    if early_stop >= max_stop:
                        self.message = f"提前停止（{early_stop}次无改善）"
                        break
                else:
                    early_stop = 0
                score_before = self._alns.score
                self.progress = min(90, 40 + int(iteration / (max_stop + 5) * 50))
                self.message = f"优化中... 迭代 {iteration} 次, 早停计数 {early_stop}/{max_stop}"

            self.score = self._alns.score.tolist() if hasattr(self._alns.score, 'tolist') else list(self._alns.score)
            self.objective_detail = self._alns.objective(self._alns.path)
            self.result_df = self._alns.result()

            self.progress = 100
            self.status = "completed"
            self.message = "优化完成！"

            output_dir = os.path.join(os.path.dirname(os.path.abspath(file_path)), "out")
            os.makedirs(output_dir, exist_ok=True)
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            self.result_path = os.path.join(output_dir, f"schedule_result_{timestamp}.csv")
            self.result_df.to_csv(self.result_path, index=False, encoding="utf-8-sig")

        except Exception as e:
            self.status = "error"
            self.error = str(e)
            self.message = f"运行出错: {e}"
            raise

    def reset(self):
        """重置引擎状态"""
        self.status = "idle"
        self.progress = 0
        self.message = ""
        self.result_df = None
        self.result_path = None
        self.score = None
        self.objective_detail = None
        self.error = None
        self._alns = None