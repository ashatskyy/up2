import { useState, useEffect, useMemo } from "react";
import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  degreesLat,
  degreesLong,
} from "satellite.js";

// const CACHE_KEY = "allSatellites";
// const CACHE_TIME_KEY = "allSatellitesTimestamp";
// const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; 

const CACHE_KEY = "satellites_tle_v2";
const CACHE_TIME_KEY = "satellites_tle_time_v2";
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

export function Sattellites({
  searchLat,
  searchLng,
  setNearSatBase,
  satColors,
}) {
  const [satellites, setSatellites] = useState([]);
  const [satrecs, setSatrecs] = useState([]);
  const [loading, setLoading] = useState(true);

  function formatDateTime(ms) {
    const date = new Date(ms);
    const day = date.getDate();
    const year = date.getFullYear();
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const month = monthNames[date.getMonth()];

    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");

    return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
	}
	










  // useEffect(() => {
  //   async function fetchSatellites() {
  //     const cached = localStorage.getItem(CACHE_KEY);
  //     const timestamp = localStorage.getItem(CACHE_TIME_KEY);
  //     const isFresh =
  //       cached &&
  //       timestamp &&
  //       Date.now() - parseInt(timestamp) < CACHE_EXPIRY_MS;

  //     let parsed;
  //     if (isFresh) {
  //       parsed = JSON.parse(cached);
  //     } else {
  //       try {
  //         const response = await fetch(
  //           "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
  //         );
  //         const text = await response.text();
  //         const lines = text.trim().split("\n");

  //         parsed = [];
  //         for (let i = 0; i < lines.length; i += 3) {
  //           parsed.push({
  //             satName: lines[i].trim(),
  //             line1: lines[i + 1].trim(),
  //             line2: lines[i + 2].trim(),
  //           });
  //         }

  //         localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
  //         const nowMs = Date.now();
  //         localStorage.setItem(CACHE_TIME_KEY, nowMs.toString());
  //       } catch (err) {
  //         console.error("Error fetching satellites:", err);
  //         setLoading(false);
  //         return;
  //       }
  //     }

  //     const satrecData = parsed.map((sat) => ({
  //       ...sat,
  //       satrec: twoline2satrec(sat.line1, sat.line2),
  //     }));
  //     setSatrecs(satrecData);
  //   }

  //   fetchSatellites();
  // }, []);


	

useEffect(() => {
  async function fetchSatellites() {
    const cachedText = localStorage.getItem(CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIME_KEY);

    const isFresh =
      cachedText &&
      timestamp &&
      Date.now() - parseInt(timestamp, 10) < CACHE_EXPIRY_MS;

    let text;

    if (isFresh) {
     
      text = cachedText;
    } else {
      try {
        const response = await fetch(
          "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
        );
        text = await response.text();

        
        localStorage.setItem(CACHE_KEY, text);
        localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } catch (err) {
        console.error("Error fetching satellites:", err);
        setLoading(false);
        return;
      }
    }

    
    const lines = text.trim().split("\n");
    const parsed = [];

    for (let i = 0; i < lines.length; i += 3) {
      parsed.push({
        satName: lines[i].trim(),
        line1: lines[i + 1].trim(),
        line2: lines[i + 2].trim(),
      });
    }

    const satrecData = parsed.map((sat) => ({
      ...sat,
      satrec: twoline2satrec(sat.line1, sat.line2),
    }));

    setSatrecs(satrecData);
  }

  fetchSatellites();
}, []);












  useEffect(() => {
    if (satrecs.length === 0) return;

    function updateSatellitePositions() {
      const now = new Date();
      const gmst = gstime(now);
      const updated = [];

      for (let i = 0; i < satrecs.length; i++) {
        const { satName, satrec } = satrecs[i];

        try {
          const positionAndVelocity = propagate(satrec, now);
          const eci = positionAndVelocity.position;
          const vel = positionAndVelocity.velocity;
          if (!eci || !vel) continue;

          const geo = eciToGeodetic(eci, gmst);
          const lat = degreesLat(geo.latitude);
          const lon = degreesLong(geo.longitude);
          const dist = getDistanceFromLatLonInKm(
            searchLat,
            searchLng,
            lat,
            lon
          );
          const altitude = geo.height;
          const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2) * 3600; // km/h

          updated.push({
            satName,
            distance: dist,
            nadirLat: lat,
            nadirLon: lon,
            altitude,
            speed,
          });
        } catch {
          // skip invalid sats
        }
      }

      setSatellites(updated);
      setLoading(false);
    }

  
    updateSatellitePositions();
    const interval = setInterval(updateSatellitePositions, 3000);
    return () => clearInterval(interval);
  }, [satrecs, searchLat, searchLng]);



  const closeSatellites = useMemo(() => {
    return satellites
      // .filter((sat) => sat.distance != null && sat.distance < 100)
      .filter((sat) => sat.distance != null && sat.distance <= 200)
      .sort((a, b) => a.distance - b.distance);
  }, [satellites]);

  useEffect(() => {
    setNearSatBase(closeSatellites);
  }, [closeSatellites, setNearSatBase]);



  return (
    
    <div
      style={{
        paddingLeft: "1rem",
        fontFamily: "sans-serif",
        
      }}
    >
      <h1>🛰️ Nearest Satellites</h1><p class="version">v 0.02</p>
      <div className="center-loaction-and-tle">
        <p style={{ fontSize: "0.7rem" }}>
          Your location: {searchLat.toFixed(4)}, {searchLng.toFixed(4)}
        </p>
        <p style={{ fontSize: "0.7rem" }}>
          Last TLE fetch:{" "}
          {localStorage.getItem(CACHE_TIME_KEY)
            ? formatDateTime(parseInt(localStorage.getItem(CACHE_TIME_KEY)))
            : "Never"}
        </p>
      </div>

      {loading ? (
        <p>Loading satellites...</p>
      ) : (
        <>
          <h2>Satellites within 200 km</h2>
          {closeSatellites.length === 0 ? (
            <p>No satellites within 200 km.</p>
          ) : (
            <ul style={{ paddingLeft: 0 }}>
              {closeSatellites.map(
                (
                  { satName, distance, nadirLat, nadirLon, altitude, speed },
                  i
                ) => (
                  <li
                    key={i}
                    style={{ marginBottom: "0.6rem", listStyle: "none" }}
                  >
                    <div className="sat-color-and-name">
                      <div
                        className={`dot ${
                          satColors.find(([name]) => name === satName)?.[1] ||
                          ""
                        }`}
                      ></div>
                      <div className="nearby-sat-name">{satName}</div>
                    </div>
                    Altitude: {altitude?.toFixed(2)} km
                    <br />
                    Speed: {speed?.toFixed(2)} km/h
                    <br />
                    <strong>Distance:</strong> {distance.toFixed(2)} km
                    <br />
                    Nadir: ({nadirLat.toFixed(4)}, {nadirLon.toFixed(4)})<br />
                  </li>
                )
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
