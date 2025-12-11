"""
Stats utilities for the Water Digital Twin Backend.
Returns mock/simulated statistics when database has no data.
"""
from typing import Dict, Any, List
from .mock_data import get_mock_stations_by_type


def calculate_overview_stats() -> Dict[str, Any]:
    """
    计算项目总览页所需的统计数据（纯模拟数据）
    当数据库无数据时使用此函数作为回退
    """
    # Mock stations count
    mock_res = get_mock_stations_by_type("reservoir")
    mock_hydro = get_mock_stations_by_type("hydrological")
    mock_rain = get_mock_stations_by_type("rain")

    total_devices = len(mock_res) + len(mock_hydro) + len(mock_rain)

    # Calculate mock reservoir capacity
    reservoir_levels_ratio_sum = 0.0
    for s in mock_res:
        if "waterLevel" in s and "guaranteeLevel" in s:
            reservoir_levels_ratio_sum += (s["waterLevel"] /
                                           s["guaranteeLevel"])

    capacity_percent = round(
        reservoir_levels_ratio_sum / len(mock_res) * 100, 1) if mock_res else 68.5

    # Calculate mock average rainfall
    total_rainfall = sum(s.get("rainfall", 0) for s in mock_rain)
    avg_rainfall = round(total_rainfall / len(mock_rain),
                         1) if mock_rain else 24.5

    # Count warnings
    warnings_count = len(
        [s for s in mock_res + mock_hydro + mock_rain if s.get("status") != "normal"])

    return {
        "online_devices": max(0, total_devices - 2),
        "total_devices": total_devices,
        "today_alerts": warnings_count,
        "reservoir_capacity_percent": capacity_percent,
        "average_rainfall_mm": avg_rainfall,
    }


def get_warning_data() -> List[Dict[str, Any]]:
    """
    获取告警数据（纯模拟数据）
    当数据库无数据时使用此函数作为回退
    """
    warnings = []

    # Check mock stations for warnings
    mock_res = get_mock_stations_by_type("reservoir")
    mock_hydro = get_mock_stations_by_type("hydrological")
    mock_rain = get_mock_stations_by_type("rain")

    for s in mock_res + mock_hydro:
        if s.get("status") == "warning":
            warnings.append({
                "id": f"wl_{s['id']}",
                "level": "Yellow",
                "message": f"{s['name']} 水位异常: {s.get('waterLevel', 0)}m",
                "time": "2025-11-27 15:00:00",
            })

    for s in mock_rain:
        if s.get("status") == "warning":
            warnings.append({
                "id": f"rf_{s['id']}",
                "level": "Yellow",
                "message": f"{s['name']} 降雨量偏高: {s.get('rainfall', 0)}mm",
                "time": "2025-11-27 15:00:00",
            })

    # Add generic mock warnings
    warnings.extend([
        {
            "id": "mock_pressure_warning",
            "level": "Red",
            "message": "钢岔管段渗压超限，请立即检查！",
            "time": "2025-11-27 15:30:00",
        },
        {
            "id": "mock_temperature_warning",
            "level": "Blue",
            "message": "某处温度异常，可能设备故障。",
            "time": "2025-11-27 15:35:00",
        }
    ])

    return warnings
