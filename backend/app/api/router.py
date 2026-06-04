from fastapi import APIRouter
from .v1 import sensors, readings, products, flood, hec_ras
from .hydrological import router as hydrological_router, flow_router
from .admin import router as admin_router
from .layers import router as layers_router

api_router = APIRouter()
api_router.include_router(sensors.router, prefix="/sensors", tags=["sensors"])
api_router.include_router(
    readings.router, prefix="/readings", tags=["readings"])
api_router.include_router(
    products.router, prefix="/products", tags=["products"])
api_router.include_router(
    flood.router, prefix="/flood", tags=["flood"])
api_router.include_router(hydrological_router)
api_router.include_router(flow_router)
api_router.include_router(admin_router)
api_router.include_router(layers_router)
api_router.include_router(hec_ras.router)
