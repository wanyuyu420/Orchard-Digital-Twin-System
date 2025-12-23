-- Update HydrologicalStations to Bachu County
-- Center: 78.56, 39.76
-- SRID 4326

UPDATE hydrological_stations
SET location = ST_SetSRID(ST_MakePoint(
    78.56 + (random() - 0.5) * 0.05,
    39.76 + (random() - 0.5) * 0.05
), 4326);

UPDATE monitoring_facilities
SET location = ST_SetSRID(ST_MakePoint(
    78.56 + (random() - 0.5) * 0.05,
    39.76 + (random() - 0.5) * 0.05
), 4326);
