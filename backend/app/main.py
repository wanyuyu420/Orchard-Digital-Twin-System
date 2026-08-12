from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.services.geoscene_service import GeoSceneService, GeoSceneError


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: verify GeoScene Server connectivity. Refuse to start if unreachable."""
    print('[Startup] Verifying GeoScene Server connectivity...')
    try:
        result = GeoSceneService.health_check()
        print(f'[Startup] GeoScene Server OK - version {result["server"]}')
        print(f'[Startup] FeatureServer OK - {result["feature_service"]}')
    except GeoSceneError as e:
        print(f'[FATAL] GeoScene Server check failed: {e}')
        print('[FATAL] The application cannot start without GeoScene Server.')
        print('[FATAL] Please verify GEOSCENE_* settings in backend/.env')
        import sys
        sys.exit(1)
    yield


app = FastAPI(
    title="Gannan Navel Orange Digital Twin",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(api_router, prefix="/api/v1")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Gannan Navel Orange Digital Twin API", "status": "ok"}


@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy", "service": "fastapi"}
