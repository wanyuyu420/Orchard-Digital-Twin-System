"""
GIS Layers API - CRUD endpoints for layer configuration
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, asc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_session
from app.models.gis_layer import GISLayer

router = APIRouter(prefix="/layers", tags=["layers"])


# ============ Schemas ============

class LayerConfig(BaseModel):
    """Layer configuration schema"""
    mapping: Optional[dict] = None
    labelField: Optional[str] = None
    autoFlyTo: Optional[bool] = None
    pointStyle: Optional[dict] = None
    realtime: Optional[dict] = None
    responseKey: Optional[str] = None
    requestParams: Optional[dict] = None
    alignment: Optional[dict] = None
    ellipsoidOffset: Optional[float] = None
    terrainOffset: Optional[float] = None
    provider: Optional[str] = None

    class Config:
        extra = "allow"  # Allow additional fields


class LayerOut(BaseModel):
    """Layer output schema"""
    id: int
    code: str
    name: str
    group_name: Optional[str] = None
    layer_type: str
    url: Optional[str] = None
    is_visible: bool
    is_enabled: bool
    icon: Optional[str] = None
    config: Optional[dict] = None
    order: int
    description: Optional[str] = None

    class Config:
        from_attributes = True


class LayerCreate(BaseModel):
    """Layer creation schema"""
    code: str
    name: str
    group_name: Optional[str] = None
    layer_type: str
    url: Optional[str] = None
    is_visible: bool = False
    is_enabled: bool = True
    icon: Optional[str] = None
    config: Optional[dict] = None
    order: int = 0
    description: Optional[str] = None


class LayerUpdate(BaseModel):
    """Layer update schema"""
    name: Optional[str] = None
    group_name: Optional[str] = None
    url: Optional[str] = None
    is_visible: Optional[bool] = None
    is_enabled: Optional[bool] = None
    icon: Optional[str] = None
    config: Optional[dict] = None
    order: Optional[int] = None
    description: Optional[str] = None


# ============ Endpoints ============

@router.get("", response_model=List[LayerOut])
async def list_layers(
    group: Optional[str] = Query(None, description="Filter by group"),
    enabled_only: bool = Query(True, description="Only return enabled layers"),
    db: AsyncSession = Depends(get_session),
):
    """Get all available layers, ordered by display order."""
    query = select(GISLayer).order_by(asc(GISLayer.order))

    if group:
        query = query.where(GISLayer.group_name == group)
    if enabled_only:
        query = query.where(GISLayer.is_enabled == True)

    result = await db.execute(query)
    layers = result.scalars().all()
    return layers


@router.get("/{layer_id}", response_model=LayerOut)
async def get_layer(
    layer_id: int,
    db: AsyncSession = Depends(get_session),
):
    """Get a specific layer by ID."""
    result = await db.execute(select(GISLayer).where(GISLayer.id == layer_id))
    layer = result.scalars().first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    return layer


@router.post("", response_model=LayerOut)
async def create_layer(
    data: LayerCreate,
    db: AsyncSession = Depends(get_session),
):
    """Create a new layer configuration."""
    # Check for duplicate code
    existing = await db.execute(select(GISLayer).where(GISLayer.code == data.code))
    if existing.scalars().first():
        raise HTTPException(
            status_code=400, detail="Layer code already exists")

    layer = GISLayer(**data.model_dump())
    db.add(layer)
    await db.commit()
    await db.refresh(layer)
    return layer


@router.put("/{layer_id}", response_model=LayerOut)
async def update_layer(
    layer_id: int,
    data: LayerUpdate,
    db: AsyncSession = Depends(get_session),
):
    """Update an existing layer configuration."""
    result = await db.execute(select(GISLayer).where(GISLayer.id == layer_id))
    layer = result.scalars().first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(layer, field, value)

    await db.commit()
    await db.refresh(layer)
    return layer


@router.patch("/{layer_id}/visibility", response_model=LayerOut)
async def toggle_layer_visibility(
    layer_id: int,
    visible: bool,
    db: AsyncSession = Depends(get_session),
):
    """Toggle layer default visibility."""
    result = await db.execute(select(GISLayer).where(GISLayer.id == layer_id))
    layer = result.scalars().first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")

    layer.is_visible = visible
    await db.commit()
    await db.refresh(layer)
    return layer


@router.delete("/{layer_id}")
async def delete_layer(
    layer_id: int,
    db: AsyncSession = Depends(get_session),
):
    """Delete a layer configuration."""
    result = await db.execute(select(GISLayer).where(GISLayer.id == layer_id))
    layer = result.scalars().first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")

    await db.delete(layer)
    await db.commit()
    return {"message": "Layer deleted", "id": layer_id}
