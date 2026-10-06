// =========================
// Draw Your Own Analysis
// This file depends on:
// - Leaflet
// - Leaflet Draw
// - Turf.js
// - drawMap initialized in script.js
// =========================

let drawToolsInitialized = false;

let drawDrawnItems = null;
let drawManualParkingItems = null;
let drawMeasurementItems = null;

let drawSelectedPolygon = null;
let drawManualParkingMode = false;
let drawAreaMeasureMode = false;

let drawBuildingLayer = null;
let drawPoiLayer = null;
let drawParkingLayer = null;
let drawAnalysisRunning = false;

// =========================
// Initialize after Draw View opens
// =========================


function initializeDrawTools() {
  if (drawToolsInitialized) return;

  if (typeof drawMap === "undefined" || !drawMap) {
    console.warn("drawMap is not ready yet.");
    return;
  }

  drawDrawnItems = new L.FeatureGroup();
  drawManualParkingItems = new L.FeatureGroup();
  drawMeasurementItems = new L.FeatureGroup();

  drawMap.addLayer(drawDrawnItems);
  drawMap.addLayer(drawManualParkingItems);
  drawMap.addLayer(drawMeasurementItems);

  const drawControl = new L.Control.Draw({
    draw: {
      polygon: {
        shapeOptions: {
          color: "#4a4a4a",
          weight: 2,
          dashArray: "6,6",
          fillOpacity: 0
        }
      },
      rectangle: {
        shapeOptions: {
          color: "#4a4a4a",
          weight: 2,
          dashArray: "6,6",
          fillOpacity: 0
        }
      },
      polyline: {
        shapeOptions: {
          color: "#111111",
          weight: 2,
          dashArray: "4,4"
        }
      },
      circle: false,
      marker: false,
      circlemarker: false
    },
    edit: {
      featureGroup: drawDrawnItems,
      edit: true,
      remove: true
    }
  });

  drawMap.addControl(drawControl);

  setupDrawMapEvents();
  setupDrawButtons();
  addDrawMeasurementButtons();

  drawToolsInitialized = true;

  const summary = document.getElementById("drawSummary");
  if (summary) {
    summary.innerHTML =
      "<p>Draw tools are ready. Search a place, draw an analysis boundary, then click <b>Run Analysis</b>.</p>";
  }
}

// =========================
// Add measurement buttons
// =========================

function addDrawMeasurementButtons() {
  const manualParkingBtn = document.getElementById("drawManualParkingBtn");
  const clearManualParkingBtn = document.getElementById("drawClearManualParkingBtn");

  if (!manualParkingBtn || !clearManualParkingBtn) return;
  if (document.getElementById("drawMeasureAreaBtn")) return;

  const measureAreaBtn = document.createElement("button");
  measureAreaBtn.id = "drawMeasureAreaBtn";
  measureAreaBtn.textContent = "Measure Area Mode";

  const clearMeasurementsBtn = document.createElement("button");
  clearMeasurementsBtn.id = "drawClearMeasurementsBtn";
  clearMeasurementsBtn.textContent = "Clear Measurements";

  clearManualParkingBtn.insertAdjacentElement("afterend", measureAreaBtn);
  measureAreaBtn.insertAdjacentElement("afterend", clearMeasurementsBtn);

  measureAreaBtn.addEventListener("click", () => {
    setDrawAreaMeasureMode(!drawAreaMeasureMode);
  });

  clearMeasurementsBtn.addEventListener("click", clearDrawMeasurements);
}

// =========================
// Map drawing events
// =========================

function setupDrawMapEvents() {
  drawMap.on(L.Draw.Event.CREATED, function (event) {
    const layer = event.layer;

    // Distance measurement
    if (event.layerType === "polyline") {
      const geojson = layer.toGeoJSON();

      const lengthMiles = turf.length(geojson, { units: "miles" });
      const lengthFeet = lengthMiles * 5280;

      layer.setStyle({
        color: "#111111",
        weight: 2,
        dashArray: "4,4"
      });

      layer.bindPopup(`
        <b>Measured Distance</b><br>
        ${lengthFeet.toFixed(0)} ft<br>
        ${lengthMiles.toFixed(2)} miles
      `);

      drawMeasurementItems.addLayer(layer);
      layer.openPopup();

      return;
    }

    // Manual parking polygon
    if (drawManualParkingMode) {
      layer.setStyle({
        color: "#777777",
        weight: 1,
        fillColor: "#bfbfbf",
        fillOpacity: 0.45
      });

      drawManualParkingItems.addLayer(layer);

      const parkingFeature = layer.toGeoJSON();
      const metrics = estimateDrawManualParkingMetrics(parkingFeature);

      layer.bindPopup(`
        <b>Manual Parking Lot</b><br>
        <b>Area:</b> ${metrics.areaSqFt.toLocaleString()} sf<br>
        <b>Estimated Spaces:</b> ${metrics.estimatedCapacity.toLocaleString()}<br>
        <b>Source:</b> Manually drawn / area ÷ 400 sf
      `);

      document.getElementById("drawSummary").innerHTML =
        "<p>Manual parking polygon added. Click <b>Run Analysis</b> again to update totals.</p>";

      return;
    }

    // Area measurement polygon
    if (drawAreaMeasureMode) {
      layer.setStyle({
        color: "#111111",
        weight: 2,
        dashArray: "4,4",
        fillColor: "#ffffff",
        fillOpacity: 0.05
      });

      const areaFeature = layer.toGeoJSON();
      const areaSqM = turf.area(areaFeature);
      const areaSqFt = areaSqM * 10.7639;
      const areaAcres = areaSqFt / 43560;

      layer.bindPopup(`
        <b>Measured Area</b><br>
        ${Math.round(areaSqFt).toLocaleString()} sf<br>
        ${areaAcres.toFixed(2)} acres
      `);

      drawMeasurementItems.addLayer(layer);
      layer.openPopup();

      document.getElementById("drawSummary").innerHTML =
        "<p>Measured area added. Use <b>Clear Measurements</b> to remove it.</p>";

      return;
    }

    // Main analysis polygon
    drawDrawnItems.clearLayers();

    layer.setStyle({
      color: "#4a4a4a",
      weight: 2,
      dashArray: "6,6",
      fillOpacity: 0
    });

    drawDrawnItems.addLayer(layer);
    drawSelectedPolygon = layer.toGeoJSON();

    document.getElementById("drawSummary").innerHTML =
      "<p>Analysis polygon selected. Click <b>Run Analysis</b>.</p>";
  });

  drawMap.on(L.Draw.Event.DELETED, function () {
    if (drawDrawnItems.getLayers().length === 0) {
      drawSelectedPolygon = null;
    }
  });

  drawMap.on(L.Draw.Event.EDITED, function () {
    drawDrawnItems.eachLayer(layer => {
      layer.setStyle({
        color: "#4a4a4a",
        weight: 2,
        dashArray: "6,6",
        fillOpacity: 0
      });

      drawSelectedPolygon = layer.toGeoJSON();
    });

    drawManualParkingItems.eachLayer(layer => {
      layer.setStyle({
        color: "#777777",
        weight: 1,
        fillColor: "#bfbfbf",
        fillOpacity: 0.45
      });
    });
  });
}

// =========================
// Button events
// =========================

function setupDrawButtons() {
  const searchBtn = document.getElementById("drawSearchBtn");
  const runBtn = document.getElementById("drawRunBtn");
  const clearBtn = document.getElementById("drawClearBtn");
  const manualParkingBtn = document.getElementById("drawManualParkingBtn");
  const clearManualParkingBtn = document.getElementById("drawClearManualParkingBtn");
  const streetViewBtn = document.getElementById("drawStreetViewBtn");

  if (searchBtn) searchBtn.addEventListener("click", searchDrawPlace);
  if (runBtn) runBtn.addEventListener("click", runDrawAnalysis);
  if (clearBtn) clearBtn.addEventListener("click", clearDrawAll);

  if (manualParkingBtn) {
    manualParkingBtn.addEventListener("click", () => {
      setDrawManualParkingMode(!drawManualParkingMode);
    });
  }

  if (clearManualParkingBtn) {
    clearManualParkingBtn.addEventListener("click", clearDrawManualParking);
  }

  if (streetViewBtn) {
    streetViewBtn.addEventListener("click", openDrawGoogleStreetView);
  }
}

// =========================
// Search place
// =========================

async function searchDrawPlace() {
  const query = document.getElementById("drawSearchInput").value.trim();

  if (!query) {
    alert("Please enter a place or address.");
    return;
  }

  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
    encodeURIComponent(query);

  try {
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json"
      }
    });

    const results = await response.json();

    if (!results || results.length === 0) {
      alert("No place found.");
      return;
    }

    const result = results[0];
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    drawMap.setView([lat, lon], 16);

    document.getElementById("drawSummary").innerHTML =
      `<p>Found: <b>${result.display_name}</b><br>Now draw the main analysis boundary.</p>`;
  } catch (error) {
    console.error(error);
    alert("Search failed. Try again.");
  }
}

// =========================
// Geo helpers
// =========================

function drawPolygonToBbox(polygon) {
  const bbox = turf.bbox(polygon);

  return {
    west: bbox[0],
    south: bbox[1],
    east: bbox[2],
    north: bbox[3]
  };
}

function isDrawFeatureInsidePolygon(feature, polygon) {
  try {
    if (feature.geometry.type === "Point") {
      return turf.booleanPointInPolygon(feature, polygon);
    }

    const centroid = turf.centroid(feature);
    return turf.booleanPointInPolygon(centroid, polygon);
  } catch (e) {
    return false;
  }
}


// =========================
// Overpass query
// =========================

async function fetchDrawOSMData(bbox) {
  const { south, west, north, east } = bbox;

  // Lighter Overpass query:
  // 1. Buildings
  // 2. Named POIs only
  // 3. Parking separately
  const query = `
    [out:json][timeout:40];
    (
      way["building"](${south},${west},${north},${east});

      node["shop"]["name"](${south},${west},${north},${east});
      way["shop"]["name"](${south},${west},${north},${east});

      node["amenity"]["name"](${south},${west},${north},${east});
      way["amenity"]["name"](${south},${west},${north},${east});

      node["tourism"]["name"](${south},${west},${north},${east});
      way["tourism"]["name"](${south},${west},${north},${east});

      node["leisure"]["name"](${south},${west},${north},${east});
      way["leisure"]["name"](${south},${west},${north},${east});

      node["office"]["name"](${south},${west},${north},${east});
      way["office"]["name"](${south},${west},${north},${east});

      node["healthcare"]["name"](${south},${west},${north},${east});
      way["healthcare"]["name"](${south},${west},${north},${east});

      way["amenity"="parking"](${south},${west},${north},${east});
      relation["amenity"="parking"](${south},${west},${north},${east});
    );

    out body geom;
  `;

  const endpoints = [
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter"
  ];

  let lastError = null;

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];

    const controller = new AbortController();

    // Give each server up to 25 seconds
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 40000);

    try {
      console.log(
        `Trying Overpass server ${i + 1}/${endpoints.length}:`,
        endpoint
      );

      const summary = document.getElementById("drawSummary");

      if (summary) {
        summary.innerHTML = `
          <p>
            <b>Loading OSM data...</b><br>
            Trying data server ${i + 1} of ${endpoints.length}.
          </p>
        `;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: "data=" + encodeURIComponent(query),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}`
        );
      }

      const osmJson = await response.json();

      if (!osmJson || !Array.isArray(osmJson.elements)) {
        throw new Error(
          "Invalid response from Overpass server."
        );
      }

      console.log(
        `Overpass request successful using server ${i + 1}:`,
        endpoint,
        `Elements: ${osmJson.elements.length}`
      );

      return drawOverpassToGeoJSON(osmJson);

    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        console.warn(
          `Overpass server ${i + 1} timed out after 40 seconds:`,
          endpoint
        );
      } else {
        console.warn(
          `Overpass server ${i + 1} failed:`,
          endpoint,
          error
        );
      }

      lastError = error;
    }
  }

  throw new Error(
    "All OSM data servers are currently unavailable. Please try again shortly."
  );
}

function drawOverpassToGeoJSON(osmJson) {
  const features = [];

  osmJson.elements.forEach(el => {
    const tags = el.tags || {};

    if (el.type === "node" && el.lat !== undefined && el.lon !== undefined) {
      features.push({
        type: "Feature",
        properties: {
          ...tags,
          osm_id: el.id,
          osm_type: "node"
        },
        geometry: {
          type: "Point",
          coordinates: [el.lon, el.lat]
        }
      });
    }

    if (el.type === "way" && el.geometry && el.geometry.length > 2) {
      const coords = el.geometry.map(p => [p.lon, p.lat]);

      const first = coords[0];
      const last = coords[coords.length - 1];

      const isClosed =
        first[0] === last[0] &&
        first[1] === last[1];

      if (!isClosed) {
        coords.push(first);
      }

      features.push({
        type: "Feature",
        properties: {
          ...tags,
          osm_id: el.id,
          osm_type: "way"
        },
        geometry: {
          type: "Polygon",
          coordinates: [coords]
        }
      });
    }

    if (el.type === "relation" && el.members) {
      const outerWays = el.members.filter(m =>
        m.role === "outer" &&
        m.geometry &&
        m.geometry.length > 2
      );

      outerWays.forEach(m => {
        const coords = m.geometry.map(p => [p.lon, p.lat]);

        const first = coords[0];
        const last = coords[coords.length - 1];

        const isClosed =
          first[0] === last[0] &&
          first[1] === last[1];

        if (!isClosed) {
          coords.push(first);
        }

        features.push({
          type: "Feature",
          properties: {
            ...tags,
            osm_id: el.id,
            osm_type: "relation"
          },
          geometry: {
            type: "Polygon",
            coordinates: [coords]
          }
        });
      });
    }
  });

  return {
    type: "FeatureCollection",
    features: features
  };
}

// =========================
// Classification
// =========================

function classifyDrawPOI(props) {
  const shop = (props.shop || "").toLowerCase();
  const amenity = (props.amenity || "").toLowerCase();
  const tourism = (props.tourism || "").toLowerCase();
  const leisure = (props.leisure || "").toLowerCase();
  const office = (props.office || "").toLowerCase();
  const healthcare = (props.healthcare || "").toLowerCase();

  const restaurantTypes = [
    "restaurant", "cafe", "fast_food", "bar", "pub",
    "ice_cream", "food_court"
  ];

  const groceryTypes = [
    "supermarket", "grocery", "convenience", "greengrocer",
    "bakery", "deli", "butcher", "seafood"
  ];

  const fashionTypes = [
    "clothes", "shoes", "jewelry", "bag", "boutique",
    "fashion", "sports"
  ];

  const homeTypes = [
    "furniture", "interior_decoration", "houseware",
    "doityourself", "hardware", "kitchen"
  ];

  const beautyTypes = [
    "beauty", "hairdresser", "cosmetics", "spa",
    "massage", "nails"
  ];

  const serviceTypes = [
    "bank", "atm", "post_office", "clinic", "dentist",
    "doctors", "pharmacy", "dry_cleaning", "laundry"
  ];

  if (restaurantTypes.includes(amenity)) return "Food & Beverage";
  if (groceryTypes.includes(shop)) return "Grocery / Food Retail";
  if (fashionTypes.includes(shop)) return "Fashion / Apparel";
  if (homeTypes.includes(shop)) return "Home / Furniture";
  if (beautyTypes.includes(shop)) return "Beauty / Personal Care";
  if (serviceTypes.includes(shop) || serviceTypes.includes(amenity) || healthcare) return "Service / Health";
  if (tourism === "hotel") return "Hotel";
  if (["fitness_centre", "sports_centre", "gym"].includes(leisure)) return "Fitness / Leisure";
  if (office) return "Office";
  if (shop) return "Other Retail";
  if (amenity) return "Other Amenity";

  return "Unknown";
}

function classifyDrawBuilding(props) {
  const building = (props.building || "").toLowerCase();
  const name = (props.name || "").toLowerCase();

  const residentialTypes = [
    "apartments",
    "house",
    "terrace",
    "detached",
    "residential",
    "semidetached_house"
  ];

  const retailTypes = [
    "retail",
    "commercial",
    "supermarket"
  ];

  if (residentialTypes.includes(building)) return "Residential";
  if (retailTypes.includes(building)) return "Retail / Commercial";
  if (building === "hotel") return "Hotel";
  if (building === "office") return "Office";
  if (building === "parking" || building === "garage") return "Parking";
  if (name.includes("apartment") || name.includes("residence")) return "Residential";

  return "Unknown";
}

function isDrawRetailLike(category) {
  return [
    "Food & Beverage",
    "Grocery / Food Retail",
    "Fashion / Apparel",
    "Home / Furniture",
    "Beauty / Personal Care",
    "Service / Health",
    "Fitness / Leisure",
    "Other Retail",
    "Other Amenity"
  ].includes(category);
}

// =========================
// Geometry analysis
// =========================

function estimateDrawBuildingMetrics(feature) {
  const areaSqM = turf.area(feature);
  const areaSqFt = areaSqM * 10.7639;

  const bbox = turf.bbox(feature);
  const west = bbox[0];
  const south = bbox[1];
  const east = bbox[2];
  const north = bbox[3];

  const widthM = turf.distance([west, south], [east, south], { units: "meters" });
  const heightM = turf.distance([west, south], [west, north], { units: "meters" });

  const depthFt = Math.min(widthM, heightM) * 3.28084;
  const lengthFt = Math.max(widthM, heightM) * 3.28084;

  return {
    areaSqFt,
    depthFt,
    lengthFt
  };
}

function estimateDrawParkingMetrics(feature) {
  const areaSqM = turf.area(feature);
  const areaSqFt = areaSqM * 10.7639;

  const rawCapacity = feature.properties.capacity || null;
  const osmCapacity = rawCapacity ? parseInt(rawCapacity, 10) : null;

  const estimatedCapacity = Math.round(areaSqFt / 400);

  return {
    areaSqFt: Math.round(areaSqFt),
    osmCapacity: Number.isFinite(osmCapacity) ? osmCapacity : null,
    estimatedCapacity: Number.isFinite(osmCapacity) ? osmCapacity : estimatedCapacity,
    capacitySource: Number.isFinite(osmCapacity)
      ? "OSM capacity tag"
      : "Estimated by area / 400 sf per space"
  };
}

function estimateDrawManualParkingMetrics(feature) {
  const areaSqM = turf.area(feature);
  const areaSqFt = areaSqM * 10.7639;
  const estimatedCapacity = Math.round(areaSqFt / 400);

  return {
    areaSqFt: Math.round(areaSqFt),
    estimatedCapacity: estimatedCapacity
  };
}

function getDrawFeaturePoint(feature) {
  if (feature.geometry.type === "Point") {
    return feature;
  }

  return turf.centroid(feature);
}

// =========================
// Styling
// =========================

function drawBuildingColor(use) {
  if (use === "Retail / Commercial") return "#e45756";
  if (use === "Residential") return "#4c78a8";
  if (use === "Hotel") return "#f2cf5b";
  if (use === "Office") return "#b279a2";
  if (use === "Parking") return "#cfcfcf";
  return "#8f8f8f";
}

function drawPoiColor(category) {
  if (category === "Food & Beverage") return "red";
  if (category === "Grocery / Food Retail") return "green";
  if (category === "Fashion / Apparel") return "purple";
  if (category === "Home / Furniture") return "orange";
  if (category === "Beauty / Personal Care") return "pink";
  if (category === "Service / Health") return "blue";
  if (category === "Fitness / Leisure") return "cadetblue";
  if (category === "Hotel") return "beige";
  if (category === "Office") return "darkviolet";
  if (category === "Other Retail") return "gray";
  return "black";
}

// =========================
// Manual parking helpers
// =========================

function getDrawManualParkingFeatures() {
  const features = [];

  drawManualParkingItems.eachLayer(layer => {
    const feature = layer.toGeoJSON();
    const metrics = estimateDrawManualParkingMetrics(feature);

    feature.properties = {
      ...feature.properties,
      parking_id: `M-${features.length + 1}`,
      parking_area_sf: metrics.areaSqFt,
      osm_capacity: null,
      estimated_capacity: metrics.estimatedCapacity,
      capacity_source: "Manually drawn / area ÷ 400 sf"
    };

    features.push(feature);
  });

  return features;
}

function setDrawManualParkingMode(active) {
  drawManualParkingMode = active;

  if (active) {
    drawAreaMeasureMode = false;
    updateDrawAreaMeasureButton(false);
  }

  const btn = document.getElementById("drawManualParkingBtn");

  if (!btn) return;

  if (drawManualParkingMode) {
    btn.textContent = "Manual Parking Mode: ON";
    btn.classList.add("active-mode");

    document.getElementById("drawSummary").innerHTML =
      "<p>Manual Parking Mode is ON. Draw parking polygons on the map.</p>";
  } else {
    btn.textContent = "Add Manual Parking Polygon";
    btn.classList.remove("active-mode");

    document.getElementById("drawSummary").innerHTML =
      "<p>Manual Parking Mode is OFF. Draw or edit the analysis polygon, then run analysis.</p>";
  }
}

// =========================
// Measurement helpers
// =========================

function updateDrawAreaMeasureButton(active) {
  const btn = document.getElementById("drawMeasureAreaBtn");
  if (!btn) return;

  if (active) {
    btn.textContent = "Measure Area Mode: ON";
    btn.classList.add("active-mode");
  } else {
    btn.textContent = "Measure Area Mode";
    btn.classList.remove("active-mode");
  }
}

function setDrawAreaMeasureMode(active) {
  drawAreaMeasureMode = active;

  if (active) {
    drawManualParkingMode = false;

    const parkingBtn = document.getElementById("drawManualParkingBtn");
    if (parkingBtn) {
      parkingBtn.textContent = "Add Manual Parking Polygon";
      parkingBtn.classList.remove("active-mode");
    }

    document.getElementById("drawSummary").innerHTML =
      "<p>Measure Area Mode is ON. Draw a polygon or rectangle to measure its area.</p>";
  } else {
    document.getElementById("drawSummary").innerHTML =
      "<p>Measure Area Mode is OFF. Draw the analysis polygon or run analysis.</p>";
  }

  updateDrawAreaMeasureButton(active);
}

function clearDrawMeasurements() {
  drawMeasurementItems.clearLayers();
  drawAreaMeasureMode = false;
  updateDrawAreaMeasureButton(false);

  document.getElementById("drawSummary").innerHTML =
    "<p>Measurements cleared.</p>";
}

// =========================
// Main analysis
// =========================

async function runDrawAnalysis() {
  // Prevent multiple simultaneous requests
  if (drawAnalysisRunning) {
    console.log("Analysis is already running.");
    return;
  }

  if (!drawSelectedPolygon) {
    alert("Please draw the main analysis boundary first.");
    return;
  }

  const runBtn = document.getElementById("drawRunBtn");
  const summary = document.getElementById("drawSummary");

  drawAnalysisRunning = true;

  if (runBtn) {
    runBtn.disabled = true;
    runBtn.textContent = "Loading...";
    runBtn.style.opacity = "0.65";
    runBtn.style.cursor = "wait";
  }

  setDrawManualParkingMode(false);
  setDrawAreaMeasureMode(false);

  if (summary) {
    summary.innerHTML = `
      <p>
        <b>Loading OSM data...</b><br>
        This may take a few seconds.
      </p>
    `;
  }

  // Remove previous analysis layers


  const bbox = drawPolygonToBbox(drawSelectedPolygon);

  try {
    // =========================
    // Load OSM data
    // =========================

    const rawGeojson = await fetchDrawOSMData(bbox);

    // Only remove the previous result AFTER new OSM data loads successfully
    if (drawBuildingLayer) {
      drawMap.removeLayer(drawBuildingLayer);
      drawBuildingLayer = null;
    }

    if (drawPoiLayer) {
      drawMap.removeLayer(drawPoiLayer);
      drawPoiLayer = null;
    }

    if (drawParkingLayer) {
      drawMap.removeLayer(drawParkingLayer);
      drawParkingLayer = null;
    }

    if (
      !rawGeojson ||
      !Array.isArray(rawGeojson.features)
    ) {
      throw new Error("Invalid OSM data received.");
    }

    let features = rawGeojson.features.filter(f =>
      isDrawFeatureInsidePolygon(f, drawSelectedPolygon)
    );

    // =========================
    // Buildings
    // =========================

    const buildings = features.filter(f =>
      f.properties &&
      f.properties.building &&
      (
        f.geometry.type === "Polygon" ||
        f.geometry.type === "MultiPolygon"
      )
    );

    // =========================
    // OSM parking
    // =========================

    const osmParkingLots = features.filter(f =>
      f.properties &&
      f.properties.amenity === "parking" &&
      (
        f.geometry.type === "Polygon" ||
        f.geometry.type === "MultiPolygon"
      )
    );

    // =========================
    // Manual parking
    // =========================

    const manualParkingLots = getDrawManualParkingFeatures();

    const parkingLots = [
      ...osmParkingLots,
      ...manualParkingLots
    ];

    // =========================
    // POIs / tenants
    // =========================

    let pois = features.filter(f =>
      f.properties &&
      f.properties.amenity !== "parking" &&
      (
        f.properties.shop ||
        f.properties.amenity ||
        f.properties.tourism ||
        f.properties.leisure ||
        f.properties.office ||
        f.properties.healthcare
      )
    );

    // Only keep named POIs
    pois = pois.filter(f =>
      f.properties.name &&
      String(f.properties.name).trim() !== ""
    );

    pois.forEach(p => {
      p.properties.tenant_category =
        classifyDrawPOI(p.properties);

      p.properties.tenant_name =
        p.properties.name || "";

      p.properties.point =
        getDrawFeaturePoint(p);
    });

    // =========================
    // Building metrics
    // =========================

    buildings.forEach((b, i) => {
      b.properties.building_id = i + 1;

      b.properties.building_use =
        classifyDrawBuilding(b.properties);

      const metrics =
        estimateDrawBuildingMetrics(b);

      b.properties.depth_est_ft =
        Math.round(metrics.depthFt);

      b.properties.length_est_ft =
        Math.round(metrics.lengthFt);

      b.properties.building_area_sf =
        Math.round(metrics.areaSqFt);
    });

    // =========================
    // Parking metrics
    // =========================

    osmParkingLots.forEach((p, i) => {
      const metrics =
        estimateDrawParkingMetrics(p);

      p.properties.parking_id =
        `O-${i + 1}`;

      p.properties.parking_area_sf =
        metrics.areaSqFt;

      p.properties.osm_capacity =
        metrics.osmCapacity;

      p.properties.estimated_capacity =
        metrics.estimatedCapacity;

      p.properties.capacity_source =
        metrics.capacitySource;
    });

    // =========================
    // Use tenant information
    // to improve building use
    // =========================

    pois.forEach(poi => {
      const point =
        poi.properties.point;

      const category =
        poi.properties.tenant_category;

      buildings.forEach(b => {
        try {
          if (turf.booleanPointInPolygon(point, b)) {

            if (isDrawRetailLike(category)) {
              b.properties.building_use =
                "Retail / Commercial";
            }

            if (category === "Hotel") {
              b.properties.building_use =
                "Hotel";
            }

            if (category === "Office") {
              b.properties.building_use =
                "Office";
            }
          }
        } catch (error) {
          console.warn(
            "Could not test POI against building:",
            error
          );
        }
      });
    });

    // =========================
    // Parking layer
    // =========================

    drawParkingLayer = L.geoJSON(
      parkingLots,
      {
        style: feature => {
          const isManual =
            feature.properties.capacity_source ===
            "Manually drawn / area ÷ 400 sf";

          return {
            fillColor:
              isManual
                ? "#bfbfbf"
                : "#d9d9d9",

            color:
              isManual
                ? "#555555"
                : "#777777",

            weight: 1,
            fillOpacity: 0.45
          };
        },

        onEachFeature: (
          feature,
          layer
        ) => {
          const area =
            feature.properties.parking_area_sf ??
            null;

          const spaces =
            feature.properties.estimated_capacity ??
            "N/A";

          const source =
            feature.properties.capacity_source ??
            "N/A";

          layer.bindPopup(`
            <b>Parking Lot ID:</b>
            ${feature.properties.parking_id || "N/A"}
            <br>

            <b>Area:</b>
            ${
              area === null
                ? "N/A"
                : area.toLocaleString()
            } sf
            <br>

            <b>Parking Spaces:</b>
            ${
              spaces === "N/A"
                ? "N/A"
                : spaces.toLocaleString()
            }
            <br>

            <b>Source:</b>
            ${source}
          `);
        }
      }
    ).addTo(drawMap);

    // =========================
    // Building layer
    // =========================

    drawBuildingLayer = L.geoJSON(
      buildings,
      {
        style: feature => ({
          fillColor:
            drawBuildingColor(
              feature.properties.building_use
            ),

          color: "#333",
          weight: 0.8,
          fillOpacity: 0.5
        }),

        onEachFeature: (
          feature,
          layer
        ) => {
          const length =
            feature.properties.length_est_ft ??
            null;

          const depth =
            feature.properties.depth_est_ft ??
            null;

          const area =
            feature.properties.building_area_sf ??
            null;

          layer.bindPopup(`
            <b>Building ID:</b>
            ${feature.properties.building_id}
            <br>

            <b>Use:</b>
            ${feature.properties.building_use}
            <br>

            <b>Length:</b>
            ${
              length === null
                ? "N/A"
                : length.toLocaleString()
            } ft
            <br>

            <b>Depth / Width:</b>
            ${
              depth === null
                ? "N/A"
                : depth.toLocaleString()
            } ft
            <br>

            <b>Area:</b>
            ${
              area === null
                ? "N/A"
                : area.toLocaleString()
            } sf
          `);
        }
      }
    ).addTo(drawMap);

    // =========================
    // POI / tenant layer
    // =========================

    drawPoiLayer =
      L.layerGroup().addTo(drawMap);

    pois.forEach(p => {
      const point =
        p.properties.point.geometry.coordinates;

      const category =
        p.properties.tenant_category;

      L.circleMarker(
        [point[1], point[0]],
        {
          radius: 3,

          color:
            drawPoiColor(category),

          fillColor:
            drawPoiColor(category),

          fillOpacity: 0.85,
          weight: 1
        }
      )
        .bindPopup(`
          <b>
            ${p.properties.tenant_name}
          </b>
          <br>

          Category:
          ${category}
          <br>

          Shop:
          ${p.properties.shop || ""}
          <br>

          Amenity:
          ${p.properties.amenity || ""}
        `)
        .addTo(drawPoiLayer);
    });

    // =========================
    // Building use counts
    // =========================

    const buildingUseCounts = {};

    buildings.forEach(b => {
      const use =
        b.properties.building_use;

      buildingUseCounts[use] =
        (buildingUseCounts[use] || 0) + 1;
    });

    // =========================
    // Tenant category counts
    // =========================

    const tenantCounts = {};

    pois.forEach(p => {
      const category =
        p.properties.tenant_category;

      tenantCounts[category] =
        (tenantCounts[category] || 0) + 1;
    });

    // =========================
    // Parking totals
    // =========================

    const totalParkingSpaces =
      parkingLots.reduce(
        (sum, p) => {
          return (
            sum +
            (
              p.properties
                .estimated_capacity || 0
            )
          );
        },
        0
      );

    const totalParkingArea =
      parkingLots.reduce(
        (sum, p) => {
          return (
            sum +
            (
              p.properties
                .parking_area_sf || 0
            )
          );
        },
        0
      );

    const osmParkingArea =
      osmParkingLots.reduce(
        (sum, p) => {
          return (
            sum +
            (
              p.properties
                .parking_area_sf || 0
            )
          );
        },
        0
      );

    const manualParkingArea =
      manualParkingLots.reduce(
        (sum, p) => {
          return (
            sum +
            (
              p.properties
                .parking_area_sf || 0
            )
          );
        },
        0
      );

    // =========================
    // Site area
    // =========================

    const siteAreaSqFt =
      turf.area(drawSelectedPolygon) *
      10.7639;

    const siteAreaAcres =
      siteAreaSqFt / 43560;

    // =========================
    // Retail building area
    // =========================

    const totalRetailBuildingArea =
      buildings.reduce(
        (sum, b) => {
          if (
            b.properties.building_use ===
            "Retail / Commercial"
          ) {
            return (
              sum +
              (
                b.properties
                  .building_area_sf || 0
              )
            );
          }

          return sum;
        },
        0
      );

    // =========================
    // Total building area
    // =========================

    const totalBuildingArea =
      buildings.reduce(
        (sum, b) => {
          return (
            sum +
            (
              b.properties
                .building_area_sf || 0
            )
          );
        },
        0
      );

    // =========================
    // Metrics
    // =========================

    const parkingRatio =
      totalRetailBuildingArea > 0
        ? totalParkingSpaces /
          (
            totalRetailBuildingArea /
            1000
          )
        : 0;

    const sfPerParkingSpace =
      totalParkingSpaces > 0
        ? totalRetailBuildingArea /
          totalParkingSpaces
        : 0;

    const buildingCoverage =
      siteAreaSqFt > 0
        ? (
            totalBuildingArea /
            siteAreaSqFt
          ) * 100
        : 0;

    // =========================
    // Final summary
    // =========================

    if (summary) {
      summary.innerHTML = `
        <p>
          <b>Site Area:</b>
          ${siteAreaAcres.toFixed(2)}
          acres
        </p>

        <p>
          <b>Total Retail Building Area:</b>
          ${Math.round(
            totalRetailBuildingArea
          ).toLocaleString()}
          sf
        </p>

        <p>
          <b>Parking Lots:</b>
          ${parkingLots.length}
        </p>

        <p>
          <b>OSM Parking Lots:</b>
          ${osmParkingLots.length}
        </p>

        <p>
          <b>Manual Parking Lots:</b>
          ${manualParkingLots.length}
        </p>

        <p>
          <b>Total Parking Area:</b>
          ${Math.round(
            totalParkingArea
          ).toLocaleString()}
          sf
        </p>

        <p>
          <b>OSM Parking Area:</b>
          ${Math.round(
            osmParkingArea
          ).toLocaleString()}
          sf
        </p>

        <p>
          <b>Manual Parking Area:</b>
          ${Math.round(
            manualParkingArea
          ).toLocaleString()}
          sf
        </p>

        <p>
          <b>Estimated Parking Spaces:</b>
          ${totalParkingSpaces.toLocaleString()}
        </p>

        <p>
          <b>Parking Ratio:</b>
          ${parkingRatio.toFixed(2)}
          spaces / 1,000 sf retail
        </p>

        <p>
          <b>SF per Parking Space:</b>
          ${
            sfPerParkingSpace > 0
              ? Math.round(
                  sfPerParkingSpace
                ).toLocaleString()
              : "N/A"
          }
          sf retail / space
        </p>

        <p>
          <b>Building Coverage:</b>
          ${buildingCoverage.toFixed(1)}%
        </p>

        <hr>

        <p>
          <b>Formula Notes</b><br>
          Site acreage = polygon area / 43,560<br>
          Retail area = sum of Retail / Commercial building footprints<br>
          Parking count = OSM capacity, or parking lot area / 400 sf; manual parking also uses area / 400 sf<br>
          Parking ratio = spaces / retail sf × 1,000<br>
          SF per parking space = retail sf / spaces<br>
          Building coverage = total building footprint area / site area
        </p>

        <hr>

        <p>
          <b>Buildings:</b>
          ${buildings.length}
        </p>

        <p>
          <b>Named Tenants:</b>
          ${pois.length}
        </p>

        <p>
          <b>Building Use</b><br>
          ${
            Object.entries(
              buildingUseCounts
            )
              .map(
                ([key, value]) =>
                  `${key}: ${value}`
              )
              .join("<br>")
          }
        </p>

        <p>
          <b>Tenant Mix</b><br>
          ${
            Object.entries(
              tenantCounts
            )
              .map(
                ([key, value]) =>
                  `${key}: ${value}`
              )
              .join("<br>")
          }
        </p>
      `;
    }

    console.log(
      "Draw analysis completed successfully."
    );

  } catch (error) {
    console.error(
      "Draw analysis failed:",
      error
    );

    if (summary) {
      summary.innerHTML = `
        <p style="color:red;">
          <b>Error loading OSM data.</b><br>
          The public OpenStreetMap data server may be busy.
          Please wait a moment and try again,
          or draw a smaller analysis area.
        </p>
      `;
    }

  } finally {
    // Always restore the button
    drawAnalysisRunning = false;

    if (runBtn) {
      runBtn.disabled = false;
      runBtn.textContent = "Run Analysis";
      runBtn.style.opacity = "";
      runBtn.style.cursor = "";
    }
  }
}

// =========================
// Clear
// =========================

function clearDrawAll() {
  if (drawDrawnItems) drawDrawnItems.clearLayers();
  if (drawManualParkingItems) drawManualParkingItems.clearLayers();
  if (drawMeasurementItems) drawMeasurementItems.clearLayers();

  drawSelectedPolygon = null;
  drawManualParkingMode = false;
  drawAreaMeasureMode = false;

  if (drawBuildingLayer) drawMap.removeLayer(drawBuildingLayer);
  if (drawPoiLayer) drawMap.removeLayer(drawPoiLayer);
  if (drawParkingLayer) drawMap.removeLayer(drawParkingLayer);

  drawBuildingLayer = null;
  drawPoiLayer = null;
  drawParkingLayer = null;

  const parkingBtn = document.getElementById("drawManualParkingBtn");
  if (parkingBtn) {
    parkingBtn.textContent = "Add Manual Parking Polygon";
    parkingBtn.classList.remove("active-mode");
  }

  updateDrawAreaMeasureButton(false);

  document.getElementById("drawSummary").innerHTML =
    "<p>Search a place, draw a custom polygon, and analyze buildings, tenants, and parking lots inside the selected area.</p>";
}

function clearDrawManualParking() {
  if (drawManualParkingItems) {
    drawManualParkingItems.clearLayers();
  }

  drawManualParkingMode = false;

  const btn = document.getElementById("drawManualParkingBtn");
  if (btn) {
    btn.textContent = "Add Manual Parking Polygon";
    btn.classList.remove("active-mode");
  }

  document.getElementById("drawSummary").innerHTML =
    "<p>Manual parking polygons cleared. Click Run Analysis again to update totals.</p>";
}

// =========================
// Google Street View
// =========================

function openDrawGoogleStreetView() {
  let lat;
  let lon;

  if (drawSelectedPolygon) {
    const center = turf.centroid(drawSelectedPolygon);

    lon = center.geometry.coordinates[0];
    lat = center.geometry.coordinates[1];
  } else {
    const mapCenter = drawMap.getCenter();

    lat = mapCenter.lat;
    lon = mapCenter.lng;
  }

  const streetViewURL =
    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;

  window.open(streetViewURL, "_blank");
}