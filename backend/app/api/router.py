from fastapi import APIRouter
from .v1.orange import router as orange_router
from .layers import router as layers_router

api_router = APIRouter()
api_router.include_router(layers_router)
api_router.include_router(orange_router)
