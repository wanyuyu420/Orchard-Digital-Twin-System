from typing import List, Dict, Any

# Ported from src/mock/simData.ts
MOCK_STATIONS = [
    # Reservoirs
    {"id": "res_001", "name": "乌鲁瓦提水库", "type": "reservoir", "waterLevel": 1962.5, "guaranteeLevel": 1968, "inflow": 125, "outflow": 110, "status": "normal"},
    {"id": "res_002", "name": "大西海子水库", "type": "reservoir", "waterLevel": 846.8, "guaranteeLevel": 850, "inflow": 85, "outflow": 90, "status": "warning"},
    {"id": "res_003", "name": "克孜尔水库", "type": "reservoir", "waterLevel": 1120, "guaranteeLevel": 1130, "inflow": 210, "outflow": 195, "status": "normal"},
    {"id": "res_004", "name": "小二库水库", "type": "reservoir", "waterLevel": 1052.3, "guaranteeLevel": 1056.8, "inflow": 95, "outflow": 88, "status": "normal"},
    {"id": "res_005", "name": "可可托海水库", "type": "reservoir", "waterLevel": 1288.5, "guaranteeLevel": 1293.5, "inflow": 165, "outflow": 158, "status": "normal"},
    {"id": "res_006", "name": "布尔津水库", "type": "reservoir", "waterLevel": 542.8, "guaranteeLevel": 548, "inflow": 280, "outflow": 275, "status": "normal"},
    
    # Hydrological
    {"id": "hyd_001", "name": "阿拉尔水文站", "type": "hydrological", "waterLevel": 1012.5, "status": "normal"},
    {"id": "hyd_002", "name": "英巴扎水文站", "type": "hydrological", "waterLevel": 892, "status": "warning"},
    
    # Rain
    {"id": "rain_001", "name": "天山北坡雨量站", "type": "rain", "rainfall": 12.5, "status": "normal"},
    {"id": "rain_002", "name": "伊犁河谷雨量站", "type": "rain", "rainfall": 25, "status": "warning"},
    {"id": "rain_003", "name": "阿尔泰山雨量站", "type": "rain", "rainfall": 8.5, "status": "normal"},
]

MOCK_FLOOD_EVENTS = [
  {
    "id": 'evt_mild',
    "name": '中小洪水演练',
    "severity": 'mild',
    "level": 'blue',
    "status": 'resolved',
    "start": '2025-09-01T00:00:00Z',
    "end": '2025-09-02T00:00:00Z',
    "region": '喀什-和田流域',
    "basin": '和田河',
    "center": { "lng": 79.6, "lat": 38.1 },
    "affectedArea": 450,
    "description": '短历时中小洪水，验证站点联动与淹没范围展示。',
    "products": {
      "inundationGeoJson": '/mock/flood/mild/inundation.geojson',
      "waterSurfaceTileset": '/mock/flood/mild/tileset.json',
      "rainGrid": '/mock/flood/mild/rain.nc',
      "timeSteps": 24,
    }
  },
  {
    "id": 'evt_large',
    "name": '大洪水演练',
    "severity": 'medium',
    "level": 'orange',
    "status": 'active',
    "start": '2025-09-05T00:00:00Z',
    "end": '2025-09-06T12:00:00Z',
    "region": '塔里木干流',
    "basin": '塔里木河',
    "center": { "lng": 82.5, "lat": 40.7 },
    "affectedArea": 1280,
    "description": '覆盖主干流的洪水过程，包含分时淹没面与水位过程线。',
    "products": {
      "inundationGeoJson": '/mock/flood/large/inundation.geojson',
      "waterSurfaceTileset": '/mock/flood/large/tileset.json',
      "rainGrid": '/mock/flood/large/rain.nc',
      "timeSteps": 36,
    }
  },
  {
    "id": 'evt_extreme',
    "name": '特大洪水演练',
    "severity": 'severe',
    "level": 'red',
    "status": 'active',
    "start": '2025-09-10T00:00:00Z',
    "end": '2025-09-12T00:00:00Z',
    "region": '伊犁河流域',
    "basin": '伊犁河',
    "center": { "lng": 81.2, "lat": 43.8 },
    "affectedArea": 2560,
    "description": '特大洪水假设场景，用于压力测试可视化与交互。',
    "products": {
      "inundationGeoJson": '/mock/flood/extreme/inundation.geojson',
      "waterSurfaceTileset": '/mock/flood/extreme/tileset.json',
      "rainGrid": '/mock/flood/extreme/rain.nc',
      "timeSteps": 48,
    }
  }
]

MOCK_RAIN_GRID_FRAMES = [
  { "id": 'rain_20250901_00', "time": '2025-09-01T00:00:00Z', "grid": '/mock/rain/20250901_00.nc', "coverage": '全疆' },
  { "id": 'rain_20250901_06', "time": '2025-09-01T06:00:00Z', "grid": '/mock/rain/20250901_06.nc', "coverage": '全疆' },
  { "id": 'rain_20250901_12', "time": '2025-09-01T12:00:00Z', "grid": '/mock/rain/20250901_12.nc', "coverage": '全疆' },
  { "id": 'rain_20250901_18', "time": '2025-09-01T18:00:00Z', "grid": '/mock/rain/20250901_18.nc', "coverage": '全疆' },
]

MOCK_IOT_DEVICES = [
  { "id": 'iot_lvl_001', "name": '水位遥测终端-阿拉尔', "protocol": 'SL651-2014', "stationId": 'hyd_001', "metrics": ['waterLevel', 'flow'], "freqSec": 300, "status": 'online' },
  { "id": 'iot_lvl_002', "name": '水位遥测终端-英巴扎', "protocol": 'SL651-2014', "stationId": 'hyd_002', "metrics": ['waterLevel', 'flow'], "freqSec": 300, "status": 'online' },
  { "id": 'iot_gate_001', "name": '闸门控制器-大西海子', "protocol": 'ModbusRTU', "stationId": 'res_002', "metrics": ['gateStatus'], "freqSec": 120, "status": 'online' },
  { "id": 'iot_rain_001', "name": '雨量站终端-伊犁', "protocol": 'RS485', "stationId": 'rain_002', "metrics": ['rainfall'], "freqSec": 600, "status": 'online' },
  { "id": 'iot_rain_007', "name": '雨量站终端-叶城', "protocol": 'RS485', "stationId": 'rain_008', "metrics": ['rainfall'], "freqSec": 600, "status": 'offline' },
]

MOCK_3D_RESOURCES = [
  {
    "id": 'urumqi_buildings',
    "name": '乌鲁木齐市建筑群',
    "source": '程序化生成',
    "tilesetUrl": '', 
    "target": { "lng": 87.617, "lat": 43.792, "height": 800 },
    "note": '使用Cesium Entity程序化生成的乌鲁木齐市建筑模拟数据。'
  },
  {
    "id": 'urumqi_water_facilities',
    "name": '乌鲁木齐水利设施',
    "source": '程序化生成',
    "tilesetUrl": '',
    "target": { "lng": 87.5, "lat": 43.7, "height": 800 },
    "note": '模拟水利基础设施：水库管理站、泵站、闸站等。'
  }
]

def get_mock_stations_by_type(station_type: str) -> List[Dict[str, Any]]:
    return [s for s in MOCK_STATIONS if s["type"] == station_type]

def get_mock_flood_events() -> List[Dict[str, Any]]:
    return MOCK_FLOOD_EVENTS

def get_mock_rain_grid_frames() -> List[Dict[str, Any]]:
    return MOCK_RAIN_GRID_FRAMES

def get_mock_iot_devices() -> List[Dict[str, Any]]:
    return MOCK_IOT_DEVICES

def get_mock_3d_resources() -> List[Dict[str, Any]]:
    return MOCK_3D_RESOURCES
