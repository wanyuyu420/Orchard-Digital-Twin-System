# 类型安全的 Pydantic 出入港安检门——输入校验、输出序列化、看板统计
from typing import List, Optional, Dict, Any
from typing_extensions import Self
from pydantic import BaseModel, Field, model_validator


# ── 输入模型 ──────────────────────────────────────────────


class SpatialQuerySchema(BaseModel):
    """
    大屏拉框空间查询请求参数（输入安检门）。
    接收前端 Cesium 弹窗抓取的 WGS84 经纬度闭合多边形点阵。
    """
    coordinates: List[List[float]] = Field(
        ...,
        min_length=4,
        example=[
            [116.499764, 27.128822],
            [116.500098, 27.128822],
            [116.500098, 27.128869],
            [116.499764, 27.128869],
            [116.499764, 27.128822],
        ],
        description="首尾相连的闭合经纬度多边形顶点数组，格式为 [[Lng, Lat], ...]"
    )
    plot_type: Optional[str] = Field(None, description="可选地块类型过滤（plot1=历史老树 / plot2=上传新树），不传则查全量")

    @model_validator(mode="after")
    def _check_closed(self) -> Self:
        first, last = self.coordinates[0], self.coordinates[-1]
        if first[0] != last[0] or first[1] != last[1]:
            raise ValueError("多边形坐标未闭合，首尾顶点必须一致")
        return self


# ── 输出模型 ──────────────────────────────────────────────


class OrangeTreeOut(BaseModel):
    """单棵脐橙树输出（供列表接口序列化）。"""
    id: int
    tree_code: str = ""
    plot_type: str = "plot1"
    lng: float
    lat: float
    confidence: Optional[float] = None
    compactness: Optional[float] = None
    shape_length: Optional[float] = None
    shape_area: Optional[float] = None
    value_field: Optional[float] = None
    count_field: Optional[float] = None
    area_m2: Optional[float] = None
    height_m: Optional[float] = None
    crown_diameter: Optional[float] = None
    volume_m3: Optional[float] = None
    growth_index: Optional[float] = None
    slope_degree: Optional[float] = None
    aspect: Optional[float] = None
    fertilizer_level: int = 0

    model_config = {"from_attributes": True}


class FertilizerStat(BaseModel):
    """变量施肥建议等级树木数量统计。"""
    light_level_count: int = Field(0, description="轻度变量施肥的果树数量")
    medium_level_count: int = Field(0, description="中度变量施肥的果树数量")
    heavy_level_count: int = Field(0, description="重度变量施肥的果树数量")


class DiagnoseResultSchema(BaseModel):
    """
    大屏右侧决策看板统计结果（输出安检门）。
    包含框选区域的聚合指标与树木明细列表。
    """
    total_count: int = Field(..., description="框选区域内的脐橙树总数")
    avg_height: Optional[float] = Field(None, description="区域内平均物理树高（米）")
    avg_area: Optional[float] = Field(None, description="区域内平均树冠投影面积（平方米）")
    avg_growth_index: Optional[float] = Field(None, description="区域内平均生长势头/健康综合指数")
    fertilizer_recommendation: FertilizerStat = Field(..., description="变量施肥分级建议统计")
    trees: List[OrangeTreeOut] = Field(default_factory=list, description="框选区域内的树木明细")

    model_config = {"from_attributes": True}


# ── 动态单体化要素回传体 (3.6 规范) ──────────────────────


class TreeFeature(BaseModel):
    """单棵树GeoJSON Polygon要素 — 前端Cesium动态单体化渲染与拾取"""
    id: int = Field(..., description="数据库唯一ID，前端点击拾取凭证")
    growth_status: str = Field(..., description="长势属性 (优良/一般/较差/未知)")
    fertilizer_kg: float = Field(..., description="变量施肥建议量 (公斤/棵)")
    area_m2: float = Field(..., description="树冠投影面积 (平方米)")
    geometry: Dict[str, Any] = Field(..., description="标准GeoJSON Polygon结构")


def growth_index_to_status(index: float | None) -> str:
    """生长指数 → 长势中文标签"""
    if index is None:
        return "未知"
    if index >= 0.7:
        return "优良"
    elif index >= 0.4:
        return "一般"
    else:
        return "较差"


def fertilizer_level_to_kg(level: int) -> float:
    """变量施肥等级 → 建议施肥量(公斤/棵)"""
    mapping = {0: 0.0, 1: 0.5, 2: 1.2, 3: 2.0}
    return mapping.get(level, 0.0)


class HistoricalTreesOut(BaseModel):
    """历史老树全量查询响应"""
    total: int
    trees: List[OrangeTreeOut]


# ── 变量施肥推荐 ──────────────────────────────────────────


class FertilizerWeights(BaseModel):
    """
    变量施肥各生长指标权重（配方秤砣）。
    四项权重之和必须为1，直接决定需肥得分的倾向性。
    """
    growth_index: float = Field(0.40, ge=0, le=1, description="生长指数权重（越不健康越需施肥）")
    size: float = Field(0.25, ge=0, le=1, description="树冠面积权重（树越大需肥越多）")
    compactness: float = Field(0.20, ge=0, le=1, description="树冠紧密度权重（越稀疏越需施肥）")
    slope: float = Field(0.15, ge=0, le=1, description="坡度权重（越陡养分越易流失）")

    @model_validator(mode="after")
    def _check_sum(self) -> Self:
        total = self.growth_index + self.size + self.compactness + self.slope
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"权重之和必须为1，当前为{total}")
        return self


class FertilizerPlanRequest(SpatialQuerySchema):
    """变量施肥推荐请求参数（输入安检门）——框选区域 + 可选权重/分级配置。"""
    weights: Optional[FertilizerWeights] = Field(None, description="各指标权重，缺省用默认配方")
    mode: str = Field("quantile", description="quantile=按区域内分位分级; fixed=固定阈值分级")
    thresholds: List[float] = Field(
        default_factory=lambda: [0.33, 0.67],
        min_length=2,
        max_length=2,
        description="fixed模式的两档阈值，需满足 0<t1<t2<1",
    )
    apply: bool = Field(False, description="是否将推荐等级写回GeoScene（经FeatureServer applyEdits）")

    @model_validator(mode="after")
    def _check_thresholds(self) -> Self:
        t1, t2 = self.thresholds
        if not (0 < t1 < t2 < 1):
            raise ValueError("阈值必须满足 0 < t1 < t2 < 1")
        if self.mode not in ("quantile", "fixed"):
            raise ValueError("mode 只能为 quantile 或 fixed")
        return self


class FertilizerPlanItem(BaseModel):
    """单棵树施肥建议明细——供前端Cesium按等级着色渲染。"""
    id: int
    lng: float
    lat: float
    growth_index: Optional[float] = None
    area_m2: Optional[float] = None
    compactness: Optional[float] = None
    slope_degree: Optional[float] = None
    health_score: float = Field(0.0, description="生长健康归一化得分 0~1（越大越健康）")
    size_score: float = Field(0.0, description="树冠面积归一化得分 0~1（越大树越大）")
    compact_score: float = Field(0.0, description="树冠紧密度归一化得分 0~1")
    slope_score: float = Field(0.0, description="坡度归一化得分 0~1（越大越陡）")
    demand_score: float = Field(0.0, description="综合需肥得分 0~1（越大越需施肥）")
    current_level: int = Field(0, description="当前施肥等级 (0:未计算, 1:轻度, 2:中度, 3:重度)")
    recommended_level: int = Field(0, description="推荐施肥等级 (1:轻度, 2:中度, 3:重度)")


class FertilizerPlanOut(BaseModel):
    """变量施肥推荐输出（输出安检门）——权重配方 + 每棵树明细 + 三档统计。"""
    total_trees: int = 0
    mode: str = "quantile"
    weights: FertilizerWeights
    thresholds: Optional[List[float]] = Field(None, description="实际采用的分级阈值")
    summary: FertilizerStat = Field(default_factory=FertilizerStat)
    plan: List[FertilizerPlanItem] = Field(default_factory=list)
    applied: bool = False


# ── 处方图导出 + 弱树告警 ─────────────────────────────────


class FertilizerExportRequest(FertilizerPlanRequest):
    """变量施肥处方图导出请求——继承施肥推荐请求，另指定导出文件格式。"""
    format: str = Field("geojson", description="导出格式: geojson=GeoJSON要素集; csv=CSV表格")

    @model_validator(mode="after")
    def _check_format(self) -> Self:
        if self.format not in ("geojson", "csv"):
            raise ValueError("format 只能为 geojson 或 csv")
        return self


class AlertTreeItem(BaseModel):
    """弱树告警明细——供前端Cesium红点高亮。"""
    id: int
    lng: float
    lat: float
    growth_index: Optional[float] = Field(None, description="当前生长指数（缺失则更需关注）")
    area_m2: Optional[float] = Field(None, description="树冠面积 (m²)")
    fertilizer_level: int = Field(0, description="当前施肥等级 (0:未计算, 1:轻度, 2:中度, 3:重度)")


class AlertsOut(BaseModel):
    """弱树巡检告警输出（输出安检门）。"""
    total: int = Field(0, description="命中的弱树数量")
    growth_threshold: float = Field(..., description="本次告警的生长指数阈值")
    alerts: List[AlertTreeItem] = Field(default_factory=list, description="弱树明细")
