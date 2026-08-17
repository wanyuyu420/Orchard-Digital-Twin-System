# 变量施肥推荐算法单元测试 — 纯函数与Schema校验，无需网络/GeoScene
import pytest
from pydantic import ValidationError

from app.api.v1.orange import (
    _minmax_normalize,
    _map_score_to_level,
    _plan_to_csv,
    _plan_to_geojson,
    _build_alerts_where,
)
from app.schemas.orange import (
    FertilizerWeights,
    FertilizerPlanRequest,
    FertilizerPlanItem,
    FertilizerPlanOut,
    FertilizerExportRequest,
    AlertTreeItem,
    AlertsOut,
)


# _minmax_normalize — 归一化


class TestMinmaxNormalize:
    def test_normal_case(self):
        """常规情形: [2,4,6] → [0,0.5,1]。"""
        assert _minmax_normalize([2.0, 4.0, 6.0]) == [0.0, 0.5, 1.0]

    def test_flat_values_return_half(self):
        """区域内无差异时全部取 0.5，避免除零。"""
        assert _minmax_normalize([3.0, 3.0, 3.0]) == [0.5, 0.5, 0.5]

    def test_single_value(self):
        """单棵树时同样取 0.5。"""
        assert _minmax_normalize([7.0]) == [0.5]

    def test_output_range(self):
        """归一化结果始终落在 0~1 闭区间。"""
        result = _minmax_normalize([0.1, 5.0, 3.0, 9.9, -2.0])
        assert all(0.0 <= v <= 1.0 for v in result)
        assert min(result) == 0.0 and max(result) == 1.0


# _map_score_to_level — 得分→施肥等级


class TestMapScoreToLevel:
    THRESHOLDS = [0.33, 0.67]

    def test_below_t1_is_level1(self):
        assert _map_score_to_level(0.0, self.THRESHOLDS) == 1
        assert _map_score_to_level(0.329, self.THRESHOLDS) == 1

    def test_between_t1_t2_is_level2(self):
        assert _map_score_to_level(0.33, self.THRESHOLDS) == 2
        assert _map_score_to_level(0.669, self.THRESHOLDS) == 2

    def test_above_t2_is_level3(self):
        assert _map_score_to_level(0.67, self.THRESHOLDS) == 3
        assert _map_score_to_level(1.0, self.THRESHOLDS) == 3

    def test_custom_thresholds(self):
        """自定义阈值同样生效。"""
        assert _map_score_to_level(0.4, [0.3, 0.5]) == 2


# FertilizerWeights — 权重配方


class TestFertilizerWeights:
    def test_default_weights_sum_to_one(self):
        w = FertilizerWeights()
        total = w.growth_index + w.size + w.compactness + w.slope
        assert total == pytest.approx(1.0)

    def test_custom_weights_ok(self):
        w = FertilizerWeights(
            growth_index=0.5, size=0.3, compactness=0.1, slope=0.1
        )
        assert w.growth_index == 0.5

    def test_sum_not_one_rejected(self):
        """权重之和≠1 必须被安检门拦下。"""
        with pytest.raises(ValidationError, match="权重之和必须为1"):
            FertilizerWeights(growth_index=0.5, size=0.5, compactness=0.2, slope=0.1)

    def test_out_of_range_rejected(self):
        with pytest.raises(ValidationError):
            FertilizerWeights(growth_index=1.5, size=-0.5, compactness=0.1, slope=-0.1)


# FertilizerPlanRequest — 请求校验


CLOSED_POLYGON = [
    [116.4970, 27.1325],
    [116.4985, 27.1325],
    [116.4985, 27.1340],
    [116.4970, 27.1340],
    [116.4970, 27.1325],
]


class TestFertilizerPlanRequest:
    def test_valid_request_with_defaults(self):
        req = FertilizerPlanRequest(coordinates=CLOSED_POLYGON)
        assert req.mode == "quantile"
        assert req.apply is False
        assert req.weights is None

    def test_open_polygon_rejected(self):
        """继承自SpatialQuerySchema的闭合校验仍生效。"""
        open_polygon = CLOSED_POLYGON[:-1] + [[116.4970, 27.1350]]
        with pytest.raises(ValidationError, match="未闭合"):
            FertilizerPlanRequest(coordinates=open_polygon)

    def test_bad_mode_rejected(self):
        with pytest.raises(ValidationError, match="mode 只能为"):
            FertilizerPlanRequest(coordinates=CLOSED_POLYGON, mode="random")

    def test_thresholds_not_ascending_rejected(self):
        with pytest.raises(ValidationError, match="阈值必须满足"):
            FertilizerPlanRequest(
                coordinates=CLOSED_POLYGON,
                mode="fixed",
                thresholds=[0.7, 0.5],
            )

    def test_thresholds_out_of_range_rejected(self):
        with pytest.raises(ValidationError, match="阈值必须满足"):
            FertilizerPlanRequest(
                coordinates=CLOSED_POLYGON,
                mode="fixed",
                thresholds=[0.3, 1.5],
            )

    def test_valid_fixed_request(self):
        req = FertilizerPlanRequest(
            coordinates=CLOSED_POLYGON,
            mode="fixed",
            thresholds=[0.3, 0.5],
            apply=True,
        )
        assert req.mode == "fixed"
        assert req.apply is True


# 评分公式端到端 — 用已知数据验证 demand_score 计算正确


class TestDemandScoreFormula:
    """复刻接口内评分公式: w1×(1-健康度) + w2×面积 + w3×(1-紧密度) + w4×坡度。"""

    def _score(self, health, size, compact, slope, weights=None):
        w = weights or FertilizerWeights()
        return (
            w.growth_index * (1 - health)
            + w.size * size
            + w.compactness * (1 - compact)
            + w.slope * slope
        )

    def test_healthiest_tree_lowest_demand(self):
        """最健康的树(健康度=1)比最差(健康度=0)需肥少。"""
        w = FertilizerWeights(growth_index=1.0, size=0.0, compactness=0.0, slope=0.0)
        best = self._score(health=1.0, size=0.5, compact=0.5, slope=0.5, weights=w)
        worst = self._score(health=0.0, size=0.5, compact=0.5, slope=0.5, weights=w)
        assert best == 0.0
        assert worst == 1.0

    def test_bigger_tree_higher_demand(self):
        w = FertilizerWeights(growth_index=0.0, size=1.0, compactness=0.0, slope=0.0)
        small = self._score(health=0.5, size=0.0, compact=0.5, slope=0.5, weights=w)
        big = self._score(health=0.5, size=1.0, compact=0.5, slope=0.5, weights=w)
        assert big > small

    def test_score_always_in_unit_interval(self):
        """归一化输入 + 权重和=1 → 得分必在 0~1。"""
        w = FertilizerWeights()  # 默认权重
        for health in (0.0, 0.3, 0.5, 1.0):
            for size in (0.0, 0.5, 1.0):
                for compact in (0.0, 0.5, 1.0):
                    for slope in (0.0, 0.5, 1.0):
                        s = self._score(health, size, compact, slope, weights=w)
                        assert 0.0 <= s <= 1.0

    def test_demand_score_output_model(self):
        """输出模型能正常构造（前端的渲染依赖这些字段）。"""
        item = FertilizerPlanItem(
            id=1,
            lng=116.4973,
            lat=27.1328,
            health_score=0.31,
            size_score=0.5,
            compact_score=0.6,
            slope_score=0.4,
            demand_score=0.52,
            current_level=0,
            recommended_level=1,
        )
        out = FertilizerPlanOut(
            total_trees=1,
            weights=FertilizerWeights(),
            summary={"light_level_count": 1, "medium_level_count": 0, "heavy_level_count": 0},
            plan=[item],
        )
        assert out.total_trees == 1
        assert out.plan[0].recommended_level == 1


# 处方图导出 — CSV / GeoJSON 纯函数


def _make_plan(levels=(1, 2, 3, 1)) -> FertilizerPlanOut:
    """构造一个含4棵树的推荐方案（避免网络/GeoScene依赖）。"""
    plan_items = [
        FertilizerPlanItem(
            id=i,
            lng=116.497 + (i - 1) * 0.0004,
            lat=27.133,
            growth_index=0.2,
            area_m2=10.0,
            demand_score=0.4 + 0.1 * (i - 1),
            current_level=0,
            recommended_level=lv,
        )
        for i, lv in enumerate(levels, start=1)
    ]
    return FertilizerPlanOut(
        total_trees=len(plan_items),
        weights=FertilizerWeights(),
        summary={"light_level_count": 2, "medium_level_count": 1, "heavy_level_count": 1},
        plan=plan_items,
    )


class TestPlanToCsv:
    def test_header_and_rows(self):
        """1行表头 + 每棵树一行（表头前可能有BOM，用包含判断）。"""
        csv_text = _plan_to_csv(_make_plan())
        lines = csv_text.strip().splitlines()
        assert "id,lng,lat,growth_index" in lines[0]
        assert len(lines) == 5

    def test_bom_prefix(self):
        """CSV 带 BOM，Excel 打开中文不乱码。"""
        assert _plan_to_csv(_make_plan()).startswith("﻿")

    def test_recommended_level_in_rows(self):
        """第一棵树的推荐等级落在行尾。"""
        csv_text = _plan_to_csv(_make_plan())
        first_row = csv_text.strip().splitlines()[1]
        assert first_row.endswith(",1")

    def test_none_metric_becomes_empty(self):
        """缺值指标输出空字符串，绝不写 None。"""
        plan = _make_plan()
        plan.plan[0].growth_index = None
        csv_text = _plan_to_csv(plan)
        first_row = csv_text.strip().splitlines()[1]
        assert ",," in first_row
        assert "None" not in csv_text


class TestPlanToGeojson:
    def test_feature_collection(self):
        gj = _plan_to_geojson(_make_plan())
        assert gj["type"] == "FeatureCollection"
        assert len(gj["features"]) == 4

    def test_point_geometry(self):
        """每棵树一个 Point 要素，坐标为 [lng, lat]。"""
        gj = _plan_to_geojson(_make_plan())
        f = gj["features"][0]
        assert f["geometry"]["type"] == "Point"
        assert f["geometry"]["coordinates"] == [116.497, 27.133]

    def test_properties_carry_levels(self):
        """推荐等级完整进入要素属性，供前端着色。"""
        gj = _plan_to_geojson(_make_plan())
        levels = [f["properties"]["recommended_level"] for f in gj["features"]]
        assert levels == [1, 2, 3, 1]


# 弱树告警 — 查询条件构造 + 输出模型


class TestBuildAlertsWhere:
    def test_threshold_in_clause(self):
        where = _build_alerts_where(0.15)
        assert "growth_idx < 0.15" in where

    def test_null_caught_as_alert(self):
        """指标缺失也算弱树。"""
        where = _build_alerts_where(0.2)
        assert "growth_idx IS NULL" in where


class TestExportRequestSchema:
    def test_default_format_geojson(self):
        req = FertilizerExportRequest(coordinates=CLOSED_POLYGON)
        assert req.format == "geojson"

    def test_csv_format_ok(self):
        req = FertilizerExportRequest(coordinates=CLOSED_POLYGON, format="csv")
        assert req.format == "csv"

    def test_bad_format_rejected(self):
        with pytest.raises(ValidationError, match="format 只能为"):
            FertilizerExportRequest(coordinates=CLOSED_POLYGON, format="xlsx")

    def test_inherits_apply(self):
        """继承施肥推荐请求的 apply 字段，写回+导出一站式。"""
        req = FertilizerExportRequest(coordinates=CLOSED_POLYGON, apply=True)
        assert req.apply is True


class TestAlertSchemas:
    def test_alert_item(self):
        item = AlertTreeItem(id=1, lng=116.497, lat=27.133, growth_index=0.05, fertilizer_level=1)
        assert item.growth_index == 0.05

    def test_alerts_out(self):
        out = AlertsOut(
            total=1,
            growth_threshold=0.15,
            alerts=[AlertTreeItem(id=2, lng=116.5, lat=27.13)],
        )
        assert out.total == 1
        assert out.alerts[0].id == 2
