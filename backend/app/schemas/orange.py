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
    batch_id: str
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
