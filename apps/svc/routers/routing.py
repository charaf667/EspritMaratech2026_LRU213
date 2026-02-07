"""
Routing service endpoint — calls OSRM Trip API for route optimization.
"""

import logging
import os
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

OSRM_BASE_URL = os.environ.get("OSRM_BASE_URL", "https://router.project-osrm.org")


class Point(BaseModel):
    lat: float
    lng: float
    label: Optional[str] = None


class RouteRequest(BaseModel):
    points: List[Point]


class RouteResponse(BaseModel):
    points: List[Point]
    optimized: bool = False
    polyline: Optional[str] = None
    total_distance_km: Optional[float] = None
    total_duration_min: Optional[float] = None


@router.post("/compute", response_model=RouteResponse)
async def compute_route(body: RouteRequest):
    """
    Accepts a list of points, calls OSRM Trip API to compute optimized route.
    Returns reordered points, polyline geometry, distance, and duration.
    """
    if len(body.points) < 2:
        return RouteResponse(points=body.points, optimized=False)

    # Build OSRM coordinates string: lng,lat;lng,lat;...
    coords_str = ";".join(f"{p.lng},{p.lat}" for p in body.points)
    osrm_url = f"{OSRM_BASE_URL}/trip/v1/driving/{coords_str}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(osrm_url, params={
                "overview": "full",
                "geometries": "polyline",
                "roundtrip": "false",
                "source": "first",
                "destination": "last",
            })

        if resp.status_code != 200:
            logger.warning("OSRM returned %s: %s", resp.status_code, resp.text)
            return RouteResponse(points=body.points, optimized=False)

        data = resp.json()

        if data.get("code") != "Ok":
            logger.warning("OSRM code: %s", data.get("code"))
            return RouteResponse(points=body.points, optimized=False)

        trips = data.get("trips", [])
        if not trips:
            return RouteResponse(points=body.points, optimized=False)

        trip = trips[0]
        waypoints = data.get("waypoints", [])

        # Reorder points by waypoint_index
        reordered = [None] * len(body.points)
        for wp in waypoints:
            idx = wp.get("waypoint_index", wp.get("trips_index", 0))
            original_idx = wp.get("waypoint_index", 0)
            if original_idx < len(body.points):
                reordered[idx] = body.points[original_idx]

        # Remove any None slots (shouldn't happen with valid data)
        reordered_clean = [p for p in reordered if p is not None]
        if not reordered_clean:
            reordered_clean = list(body.points)

        # Extract polyline and totals
        polyline = trip.get("geometry", "")
        distance_m = trip.get("distance", 0)
        duration_s = trip.get("duration", 0)

        return RouteResponse(
            points=reordered_clean,
            optimized=True,
            polyline=polyline,
            total_distance_km=round(distance_m / 1000, 2),
            total_duration_min=round(duration_s / 60, 1),
        )

    except httpx.RequestError as e:
        logger.exception("OSRM request failed: %s", e)
        return RouteResponse(points=body.points, optimized=False)
