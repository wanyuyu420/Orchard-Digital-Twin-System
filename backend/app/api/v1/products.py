from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_session
from app.models import ModelProduct, RasterProduct, VectorProduct
from app.schemas.sensor import ProductOut

router = APIRouter()


@router.get("/models", response_model=list[ProductOut])
async def list_model_products(is_simulated: bool | None = None, session: AsyncSession = Depends(get_session)):
    stmt = select(ModelProduct)
    if is_simulated is not None:
        stmt = stmt.where(ModelProduct.is_simulated == is_simulated)
    rows = (await session.execute(stmt)).scalars().all()
    return [
        ProductOut(
            id=r.id,
            domain=r.domain,
            name=r.name,
            version=r.version,
            valid_from=r.valid_from,
            valid_to=r.valid_to,
            product_type=r.product_type,
            path=r.path,
            meta=r.meta,
            is_simulated=r.is_simulated,
        )
        for r in rows
    ]


@router.get("/rasters", response_model=list[ProductOut])
async def list_raster_products(is_simulated: bool | None = None, session: AsyncSession = Depends(get_session)):
    stmt = select(RasterProduct)
    if is_simulated is not None:
        stmt = stmt.where(RasterProduct.is_simulated == is_simulated)
    rows = (await session.execute(stmt)).scalars().all()
    return [
        ProductOut(
            id=r.id,
            domain=r.domain,
            name=r.name,
            version=None,
            valid_from=r.time_start,
            valid_to=r.time_end,
            product_type=r.product_type,
            path=r.path,
            meta=r.meta,
            is_simulated=r.is_simulated,
        )
        for r in rows
    ]


@router.get("/vectors", response_model=list[ProductOut])
async def list_vector_products(is_simulated: bool | None = None, session: AsyncSession = Depends(get_session)):
    stmt = select(VectorProduct)
    if is_simulated is not None:
        stmt = stmt.where(VectorProduct.is_simulated == is_simulated)
    rows = (await session.execute(stmt)).scalars().all()
    return [
        ProductOut(
            id=r.id,
            domain=r.domain,
            name=r.name,
            version=None,
            valid_from=r.time_start,
            valid_to=r.time_end,
            product_type=r.product_type,
            path=r.path,
            meta=r.meta,
            is_simulated=r.is_simulated,
        )
        for r in rows
    ]
