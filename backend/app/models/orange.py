from typing import Optional
from sqlalchemy import Integer, Float, String
from sqlalchemy.orm import Mapped, mapped_column

# 严格走多数据库兼容层
from app.compat import Geometry  
from app.database import Base

class OrangeTree(Base):
    """
    赣南脐橙树木长效要素资产表
    严格对齐原项目 SQLAlchemy 2.0 现代风格与多数据库(SQLite/PostgreSQL)兼容层
    """
    __tablename__ = "orange_trees"

    # 1. 身份标识
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, comment="树木唯一身份证号")
    batch_id: Mapped[str] = mapped_column(String, index=True, default="historical_zone", comment="数据批次标签(如历史示范区或上传时间戳)")
    
    # 核心修正：类型提示统一标注为 Mapped[str]，彻底适配兼容层动态函数调用
    # 空间几何字段（SQLite下自动降级为Text存储WKT，Postgres下为原生PostGIS）
    geom: Mapped[str] = mapped_column(
        Geometry(geometry_type='POINT', srid=32650, spatial_index=True), 
        nullable=False, 
        comment="树木中心点空间要素(UTM 50N 平面直角坐标)"
    )

    # 3. 无人机、SAM 大模型及遥感反演全保留字段（精准对齐 shp 属性表）
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="SAM 模型边缘分割置信度")
    compactness: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="树冠圆度/紧凑度")
    shape_length: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="树冠几何边界周长(米)")
    shape_area: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="树冠几何边界面真面积(平方米)")
    
    value_field: Mapped[Optional[float]] = mapped_column(Float, nullable=True, name="value", comment="原始栅格像素值")
    count_field: Mapped[Optional[float]] = mapped_column(Float, nullable=True, name="count", comment="树冠包含的像素计数")
    
    area_m2: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="栅格反演树冠投影面积(平方米)")
    height_m: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="Meta 大模型反演物理树高(米)")
    crown_diameter: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="树冠冠幅直径(米)")
    volume_m3: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="脐橙树三维材积估计(立方米)")
    growth_index: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="生长势头/健康综合指数")
    
    # 4. 地形微气候特征字段
    slope_degree: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="所在山头地形坡度(度)")
    aspect: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="所在山头地形坡向(度)")

    # 5. 数字孪生变量施肥决策字段
    fertilizer_level: Mapped[int] = mapped_column(Integer, default=0, comment="变量施肥建议等级(0:未计算, 1:轻度, 2:中度, 3:重度)")