import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import radarBeep from "./assets/mixkit-airport-radar-ping-1582.mp3";
import { Sattellites } from "./Sattellites";

export function App() {
  const beepAudioRef = useRef(null);
  const audioEnabledRef = useRef(false);

  const mapContRef = useRef(null);
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);

  const markersRef = useRef({});
  const colorIndexRef = useRef(0);
  const satColorMapRef = useRef({});

  const [circleSize, setCircleSize] = useState(0);
  const [searchMode, setSearchMode] = useState(false);
  // const [centerCoords, setCenterCoords] = useState({ lat: 20, lng: 0 });
  const [centerCoords, setCenterCoords] = useState({ lat: 0, lng: 0 });
  const [nearSatBase, setNearSatBase] = useState([]);
  const [satColors, setSatColors] = useState([]);

  const colorClasses = useMemo(
    () => [
      "custom-red-dot",
      "custom-orange-dot",
      "custom-yellow-dot",
      "custom-green-dot",
      "custom-blue-dot",
      "custom-magenta-dot",
      "custom-brown-dot",
      "custom-pink-dot",
      "custom-lime-dot",
      "custom-teal-dot",
      "custom-indigo-dot",

      // "custom-cyan-dot",

      // "custom-olive-dot",

      // "custom-navy-dot",

      // "custom-gold-dot",
      // "custom-silver-dot",
      // "custom-coral-dot",
      // "custom-peru-dot",
    ],
    []
  );

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setCircleSize(Math.min(width, height));
    });

    if (mapContRef.current) observer.observe(mapContRef.current);
    return () => observer.disconnect();
  }, []);
  //ебаны в рот, а так...
  // ResizeObserver это API бразера
  // observer.observe(mapContRef.current) - вызывает его для
  // DOM элемента mapContRef.current
  // ЧТО-БЫ в конечном итоге устновть  setCircleSize(Math.min(width, height))
  // который затем будет использоваться для установки правильных размеров
  // таким образом устновка  setCircleSize(Math.min(width, height)); и есть
  // суть данного useEffect

  useEffect(() => {
    if (!mapRef.current) return;

    const map = L.map(mapRef.current, {
      maxBounds: [
        [-85, -Infinity],
        [85, Infinity],
      ],
      zoom: 2,
      minZoom: 2,
      maxBoundsViscosity: 1.0,
      zoomSnap: 0,
      zoomDelta: 0.1,
      worldCopyJump: true,
    }).setView([0, 0], 2);

    leafletMapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const onMove = () => {
      const center = map.getCenter();
      setCenterCoords({ lat: center.lat, lng: center.lng });
    };

    map.on("move", onMove);
    onMove();

    return () => {
      map.off("move", onMove);
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!leafletMapRef.current) return;
    const map = leafletMapRef.current;

    Object.keys(markersRef.current).forEach((satName) => {
      if (!nearSatBase.find((sat) => sat.satName === satName)) {
        map.removeLayer(markersRef.current[satName]);
        delete markersRef.current[satName];
        delete satColorMapRef.current[satName];
        setSatColors((prev) => prev.filter(([n]) => n !== satName));
      }
    });

    if (!searchMode || nearSatBase.length === 0) {
      Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
      markersRef.current = {};
      satColorMapRef.current = {};
      setSatColors([]);
      return;
    }

    nearSatBase.forEach(({ satName, nadirLat, nadirLon }) => {
      if (nadirLat == null || nadirLon == null) return;

      if (!satColorMapRef.current[satName]) {
        const color = colorClasses[colorIndexRef.current];
        colorIndexRef.current =
          (colorIndexRef.current + 1) % colorClasses.length;
        satColorMapRef.current[satName] = color;
        setSatColors((prev) => [...prev, [satName, color]]);
      }

      const dotClass = satColorMapRef.current[satName];

      if (markersRef.current[satName]) {
        markersRef.current[satName].setLatLng([nadirLat, nadirLon]);
      } else {
        const marker = L.marker([nadirLat, nadirLon], {
          icon: L.divIcon({ className: dotClass, iconSize: [20, 20] }),
        }).addTo(map);

        markersRef.current[satName] = marker;

        if (audioEnabledRef.current) {
          const audio = beepAudioRef.current;
          audio.currentTime = 0;
          audio.play().catch(() => {});
        }
      }
    });
  }, [nearSatBase, searchMode, colorClasses]);

  function watchMode() {
    if (!beepAudioRef.current) {
      const audio = new Audio(radarBeep);
      audio.muted = true;

      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
          beepAudioRef.current = audio;
          audioEnabledRef.current = true;
        })
        .catch(() => {});
    } else {
      audioEnabledRef.current = true;
    }

    colorIndexRef.current = 0;
    satColorMapRef.current = {};
    setSearchMode(true);

    if (leafletMapRef.current) {
      leafletMapRef.current.setZoom(
        Math.log2(
          (40075017 * Math.cos((centerCoords.lat * Math.PI) / 180)) /
            // (256 * (200000 / circleSize))
            (256 * (400000 / circleSize))
        )
      );

      leafletMapRef.current.dragging.disable();
      leafletMapRef.current.scrollWheelZoom.disable();
      leafletMapRef.current.doubleClickZoom.disable();
      leafletMapRef.current.boxZoom.disable();
      leafletMapRef.current.keyboard.disable();
      leafletMapRef.current.touchZoom.disable();
      leafletMapRef.current.tap?.disable();
    }
  }

  function MapMode() {
    setSearchMode(false);

    if (leafletMapRef.current) {
      // leafletMapRef.current.setView([20, 0], 2);
      leafletMapRef.current.setView([0, 0], 2);
      leafletMapRef.current.dragging.enable();
      leafletMapRef.current.scrollWheelZoom.enable();
      leafletMapRef.current.doubleClickZoom.enable();
      leafletMapRef.current.boxZoom.enable();
      leafletMapRef.current.keyboard.enable();
      leafletMapRef.current.touchZoom.enable();
      leafletMapRef.current.tap?.enable();
    }

    // setCenterCoords({ lat: 20, lng: 0 });
    setCenterCoords({ lat: 0, lng: 0 });
  }

  return (
    <div className="cont">
      <div className="map-cont" ref={mapContRef}>
        <div id="map" ref={mapRef}></div>

        <div
          className="round-template"
          style={
            searchMode
              ? {
                  display: "block",
                  background: `radial-gradient(circle, transparent ${
                    circleSize / 2
                  }px, black ${circleSize / 2 + 1}px)`,
                }
              : {}
          }
        />

        <div className="center-marker">+</div>
      </div>

      <div className="data-cont">
        <div className="current-position">
          Lat: {centerCoords.lat.toFixed(4)}, Lng: {centerCoords.lng.toFixed(4)}
        </div>

        <button className="watch-mode" onClick={watchMode}>
          Watch Mode
        </button>

        <button className="map-mode" onClick={MapMode}>
          Map Mode
        </button>

        {searchMode && (
          <Sattellites
            searchLat={centerCoords.lat}
            searchLng={centerCoords.lng}
            setNearSatBase={setNearSatBase}
            satColors={satColors}
          />
        )}
      </div>
    </div>
  );
}
