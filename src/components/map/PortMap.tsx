"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap, Marker, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { IYardView, IVehicleView } from "@/lib/types";

interface PortMapProps {
  yards?: IYardView[];
  vehicles?: IVehicleView[];
  selectedVehicleId?: string | null;
  onSelectVehicle?: (vehicleId: string) => void;
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  showBreadcrumbTrail?: [number, number][]; // optional history path
}

export function PortMap({
  yards = [],
  vehicles = [],
  selectedVehicleId,
  onSelectVehicle,
  center = [81.1180, 6.1205],
  zoom = 14.5,
  showBreadcrumbTrail,
}: PortMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);

  // 1. Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const tileUrl =
      process.env.NEXT_PUBLIC_MAP_TILE_URL ||
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [tileUrl],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap Contributors",
          },
        },
        layers: [
          {
            id: "osm-layer",
            type: "raster",
            source: "osm",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: center,
      zoom: zoom,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    map.on("load", () => {
      setMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Render Yard GeoJSON Polygons
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || yards.length === 0) return;

    const geojsonData: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: yards.map((y) => ({
        type: "Feature",
        id: y.id,
        properties: {
          id: y.id,
          name: y.name,
          code: y.code,
          category: y.category,
          capacity: y.capacity,
          currentCount: y.currentCount,
          color: y.color || "#3b82f6",
        },
        geometry: y.boundary,
      })),
    };

    if (map.getSource("yards-source")) {
      (map.getSource("yards-source") as maplibregl.GeoJSONSource).setData(geojsonData);
    } else {
      map.addSource("yards-source", {
        type: "geojson",
        data: geojsonData,
      });

      // Polygon Fill
      map.addLayer({
        id: "yards-fill",
        type: "fill",
        source: "yards-source",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.25,
        },
      });

      // Polygon Outline
      map.addLayer({
        id: "yards-outline",
        type: "line",
        source: "yards-source",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2.5,
        },
      });

      // Yard Label
      map.addLayer({
        id: "yards-labels",
        type: "symbol",
        source: "yards-source",
        layout: {
          "text-field": ["concat", ["get", "code"], "\n", ["get", "name"]],
          "text-size": 11,
          "text-font": ["Open Sans Bold"],
          "text-anchor": "center",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });
    }
  }, [mapLoaded, yards]);

  // 3. Render Historical Breadcrumb Trail if present
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (showBreadcrumbTrail && showBreadcrumbTrail.length > 1) {
      const trailData: GeoJSON.Feature = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: showBreadcrumbTrail,
        },
      };

      if (map.getSource("trail-source")) {
        (map.getSource("trail-source") as maplibregl.GeoJSONSource).setData(trailData);
      } else {
        map.addSource("trail-source", {
          type: "geojson",
          data: trailData,
        });

        map.addLayer({
          id: "trail-layer",
          type: "line",
          source: "trail-source",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#f59e0b",
            "line-width": 4,
            "line-dasharray": [2, 1],
          },
        });
      }
    } else {
      if (map.getLayer("trail-layer")) map.removeLayer("trail-layer");
      if (map.getSource("trail-source")) map.removeSource("trail-source");
    }
  }, [mapLoaded, showBreadcrumbTrail]);

  // 4. Render Vehicle Markers with Heading Rotation & Status
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const currentMarkers = markersRef.current;
    const activeVehicleIds = new Set<string>();

    vehicles.forEach((v) => {
      const lng = v.longitude ?? v.lastLongitude;
      const lat = v.latitude ?? v.lastLatitude;
      if (!lng || !lat) return;
      activeVehicleIds.add(v.id);

      const statusColors: Record<string, string> = {
        ONLINE: "#22c55e",             // Green
        STALE: "#eab308",              // Amber
        OFFLINE: "#64748b",            // Gray
        TRACKING_INTERRUPTED: "#ef4444",// Red
        NOT_ON_DUTY: "#94a3b8",        // Slate
      };

      const markerColor = statusColors[v.trackingStatus] || "#3b82f6";
      const isSelected = selectedVehicleId === v.id;

      let marker = currentMarkers.get(v.id);

      if (!marker) {
        // Create custom DOM element for vehicle marker
        const el = document.createElement("div");
        el.className = "cursor-pointer transition-transform duration-300";
        el.innerHTML = `
          <div class="relative flex flex-col items-center group">
            <div class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center font-bold text-[10px] text-white" style="background-color: ${markerColor}">
              <div class="transform transition-transform" style="transform: rotate(${v.lastHeading || 0}deg)">
                ▲
              </div>
            </div>
            <div class="mt-1 px-1.5 py-0.5 bg-slate-900/90 text-white rounded text-[10px] font-semibold tracking-wider whitespace-nowrap shadow border border-slate-700">
              ${v.vehicleNumber}${v.assignedDriverName ? ` (${v.assignedDriverName})` : ""}
            </div>
          </div>
        `;

        el.addEventListener("click", () => {
          if (onSelectVehicle) onSelectVehicle(v.id);
        });

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);

        currentMarkers.set(v.id, marker);
      } else {
        // Update position and appearance
        marker.setLngLat([lng, lat]);
        const el = marker.getElement();
        const iconDiv = el.querySelector("div > div:first-child") as HTMLElement;
        const arrowDiv = el.querySelector("div > div:first-child > div") as HTMLElement;

        if (iconDiv) {
          iconDiv.style.backgroundColor = markerColor;
          if (isSelected) {
            iconDiv.style.boxShadow = "0 0 0 4px #38bdf8";
          } else {
            iconDiv.style.boxShadow = "";
          }
        }
        if (arrowDiv) {
          arrowDiv.style.transform = `rotate(${v.lastHeading || 0}deg)`;
        }
      }
    });

    // Remove markers for vehicles no longer present
    for (const [id, marker] of currentMarkers.entries()) {
      if (!activeVehicleIds.has(id)) {
        marker.remove();
        currentMarkers.delete(id);
      }
    }
  }, [mapLoaded, vehicles, selectedVehicleId, onSelectVehicle]);

  // 5. Pan to selected vehicle if requested
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedVehicleId) return;

    const selected = vehicles.find((v) => v.id === selectedVehicleId);
    if (selected && selected.longitude && selected.latitude) {
      map.flyTo({
        center: [selected.longitude, selected.latitude],
        zoom: Math.max(map.getZoom(), 15.5),
        essential: true,
      });
    }
  }, [selectedVehicleId, vehicles]);

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-xl overflow-hidden shadow-inner border border-slate-800">
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
