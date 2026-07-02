let projects = [];
let tenants = [];
let projectMarkers = [];
let markerByProjectId = {};
let highlightedMarker = null;
let traderJoePrototypes = [];
let tjCoTenants = [];
let tjCategorySummary = [];
let tjAdjacentCategoryFrequency = [];
let tjAdjacentStoreFrequency = [];
let tjAdjacentByPrototypeCategory = [];
let tjAdjacentByPrototypeStore = [];
let tjAdjacentImmediateCategoryFrequency = [];
let tjAdjacentPrototypeTopSummary = [];
let tjAdjacentTenantsLong = [];

let adjacentCharts = [];

let adjacentTenantTableMode = "summary";

let prototypeDisplayMode = "matrix"; // "matrix" or "cotenant"
let coTenantTableMode = "frequency"; // "frequency" or "category"

const matrixModeConfig = {
  layout: {
    label: "Layout Prototype",
    subtitle: "Trader Joe’s locations grouped by site layout pattern",
    field: "Prototype",
    showDiagram: true,
    order: [
      "Urban Context",
      "Standalone",
      "Mall / Destination",
      "Branch",
      "Spine",
      "C-Shape",
      "Cluster"
    ],
    tooltip:
      "Groups projects by Trader Joe’s site layout pattern. In the diagrams, dark red shows Trader Joe’s, pink shows other buildings, gray shows parking, blue dashed lines show major urban roads, and black lines show main internal circulation."
  },

  typology: {
    label: "Typology of Center",
    subtitle: "Trader Joe’s locations grouped by overall retail center typology",
    field: "TypologyOfCenter",
    showDiagram: false,
    order: [
      "Urban",
      "Inner Suburban",
      "Suburban",
      "Lifestyle",
      "Power",
      "Town Center",
      "Convenience / Neighborhood"
    ],
    tooltip:
      "Groups projects by the overall type of retail center, based on urban context, tenant mix, parking pattern, walkability, and whether the center functions as a neighborhood, suburban, power, lifestyle, or town-center environment."
  },

  position: {
    label: "TJ Position in Center",
    subtitle: "Trader Joe’s locations grouped by position within the retail center",
    field: "TraderJoesPosition",
    showDiagram: false,
    order: [
      "Urban Block",
      "Freestanding / Pad",
      "Major Anchor",
      "Junior Anchor",
      "End Cap",
      "Inline"
    ],
    tooltip:
      "Groups projects by where Trader Joe’s sits within the center, such as an urban block, freestanding pad, major anchor, junior anchor, end cap, or inline tenant."
  },

  parking: {
    label: "Parking Location",
    subtitle: "Trader Joe’s locations grouped by the location and format of customer parking",
    field: "ParkingLocation",
    showDiagram: false,
    order: [
      "Front Field",
      "Side Field",
      "Shared Field",
      "Structured",
      "Rear / Integrated"
    ],
    tooltip:
      "Groups projects by the parking condition closest to Trader Joe’s, including front field, side field, shared surface parking, structured garage parking, or rear/integrated parking."
  },

  visibility: {
    label: "Visibility to Main Road",
    subtitle: "Trader Joe’s locations grouped by visibility from the main road",
    field: "TJVisibilityToMainRoad",
    showDiagram: false,
    order: [
      "Yes",
      "No"
    ],
    tooltip:
      "Groups projects by whether Trader Joe’s facade, entrance, or signage is clearly visible from the main road. Yes means visible from the road; No means it is hidden until entering the site."
  },

  size: {
    label: "Size of TJ",
    subtitle: "Trader Joe’s locations grouped by store size",
    field: "TJSize",
    showDiagram: false,
    order: [
      "Under 10k",
      "10k–12k",
      "12k–15k",
      "15k–18k",
      "18k+"
    ],
    tooltip:
      "Groups projects by the size of Trader Joe’s. Buckets are based on TJSize: under 10k SF, 10k–12k SF, 12k–15k SF, 15k–18k SF, and 18k+ SF."
  },

    storefront: {
    label: "Storefront Type",
    subtitle: "Trader Joe’s locations grouped by storefront architectural expression",
    field: "Storefront",
    showDiagram: false,
    order: [
      "Urban Storefront",
      "Flat Parapet Storefront",
      "Gabled / Pitched-Roof Storefront",
      "Decorative Storefront",
      "Contemporary Entrance Tower",
      "Custom Storefront"
    ],
    tooltip:
      "Groups Trader Joe’s locations by storefront design, including urban embedded storefronts, flat parapet facades, pitched-roof forms, decorative traditional facades, contemporary entrance towers, and customized storefronts."
  },

    residential: {
     label: "Residential Relationship",
     subtitle: "Trader Joe’s locations grouped by multifamily proximity and connection quality",
     field: "ResidentialRelationship",
     showDiagram: false,
     order: [
        "No Multifamily Within 1000 ft",
       "Acceptable Connection",
       "Nice Connection"
     ],
     tooltip:
    "Groups Trader Joe’s locations by whether multifamily residential exists within 1,000 ft and the quality of the connection between nearby residential areas and Trader Joe’s."
  }
};

let matrixMode = "layout";

let matrixCardsCompact = false;
let matrixImageMode = "siteplan"; // "siteplan" or "storefront"

let matrixHighlightSelections = {};
Object.keys(matrixModeConfig).forEach(mode => {
  matrixHighlightSelections[mode] = [];
});

let selectedMatrixTypes = {};
Object.keys(matrixModeConfig).forEach(mode => {
  selectedMatrixTypes[mode] = [...matrixModeConfig[mode].order];
});


let compareProjects = [];
let compareMiniMaps = [];
const MAX_COMPARE_PROJECTS = 4;

// Map
const map = L.map("map").setView([39.5, -96.5], 4);

// Base maps
const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap"
});

const satelliteLayer = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 19,
    attribution: "Tiles © Esri"
  }
);

// Add default base map
osmLayer.addTo(map);

// Base map switch control
const baseMaps = {
  "OSM": osmLayer,
  "Satellite": satelliteLayer
};

L.control.layers(baseMaps, null, {
  position: "topright",
  collapsed: false
}).addTo(map);

const legend = L.control({ position: "bottomleft" });

legend.onAdd = function () {
  const div = L.DomUtil.create("div", "legend");

  div.innerHTML = `
    <strong>GLA</strong><br>
    <span class="legend-dot" style="background:#2ca25f"></span> ≤ 100,000 SF<br>
    <span class="legend-dot" style="background:#f28e2b"></span> > 100,000 SF
  `;

  return div;
};

legend.addTo(map);

// Load data
Promise.all([
  loadCSV("data/project_metrics_website.csv"),
  loadCSV("data/tenants_classified_v6.csv"),
  loadCSV("data/trader_joes_prototypes.csv"),
  loadCSV("WithinCenter/tj_co_tenants_rechecked.csv"),
  loadCSV("WithinCenter/tj_49_category_summary.csv"),

  // Adjacent tenant analysis CSVs
  loadCSV("WithinCenter/tj_adjacent_category_frequency.csv"),
  loadCSV("WithinCenter/tj_adjacent_store_frequency.csv"),
  loadCSV("WithinCenter/tj_adjacent_by_prototype_category.csv"),
  loadCSV("WithinCenter/tj_adjacent_by_prototype_store.csv"),
  loadCSV("WithinCenter/tj_adjacent_immediate_category_frequency.csv"),
  loadCSV("WithinCenter/tj_adjacent_prototype_top_summary.csv"),
  loadCSV("WithinCenter/tj_adjacent_tenants_long.csv")
]).then(([
  projectData,
  tenantData,
  prototypeData,
  coTenantData,
  categorySummaryData,

  adjacentCategoryFrequencyData,
  adjacentStoreFrequencyData,
  adjacentByPrototypeCategoryData,
  adjacentByPrototypeStoreData,
  adjacentImmediateCategoryFrequencyData,
  adjacentPrototypeTopSummaryData,
  adjacentTenantsLongData
]) => {
  projects = projectData;
  tenants = tenantData;
  traderJoePrototypes = prototypeData;
  tjCoTenants = coTenantData;
  tjCategorySummary = categorySummaryData;

  tjAdjacentCategoryFrequency = adjacentCategoryFrequencyData;
  tjAdjacentStoreFrequency = adjacentStoreFrequencyData;
  tjAdjacentByPrototypeCategory = adjacentByPrototypeCategoryData;
  tjAdjacentByPrototypeStore = adjacentByPrototypeStoreData;
  tjAdjacentImmediateCategoryFrequency = adjacentImmediateCategoryFrequencyData;
  tjAdjacentPrototypeTopSummary = adjacentPrototypeTopSummaryData;
  tjAdjacentTenantsLong = adjacentTenantsLongData;

  buildOwnerFilter(projects);
  buildStateFilter(projects);
  addProjectMarkers();
});

function loadCSV(path) {
  return new Promise((resolve) => {
    Papa.parse(path, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: function(results) {
        resolve(results.data);
      }
    });
  });
}

function getOwnerGroup(owner) {
  owner = String(owner || "").trim();

  const majorOwners = [
    "Kimco",
    "Brixmor",
    "Regency Centers",
    "federalrealty",
    "Invesco Real Estate",
    "Oxford Properties",
    "Atlantic Development",
    "Linear Retail Properties",
    "Samuels & Associates",
    "Wilder",
    "Phillips Edison & Company"
  ];

  if (majorOwners.includes(owner)) {
    return owner;
  }

  return "Other";
}

function buildOwnerFilter(projectsData) {
  const ownerFilter = document.getElementById("ownerFilter");
  if (!ownerFilter) return;

  const owners = [...new Set(
    projectsData
      .map(project => getOwnerGroup(project["Owner"]))
      .filter(owner => owner !== "")
  )].sort();

  ownerFilter.innerHTML = "";

  owners.forEach(owner => {
    const label = document.createElement("label");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = owner;
    checkbox.checked = true;

    checkbox.addEventListener("change", applyFilters);

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(owner));

    ownerFilter.appendChild(label);
  });
}

function getProjectState(project) {
  // If you later add a separate "State" column, this will also work.
  if (project["State"] && String(project["State"]).trim() !== "") {
    return String(project["State"]).trim().toUpperCase();
  }

  // Current CSV format: "City/State", for example "Durham, NC"
  const cityState = project["City/State"];

  if (!cityState || String(cityState).trim() === "") {
    return "";
  }

  const parts = String(cityState).split(",");
  const state = parts[parts.length - 1].trim();

  return state.toUpperCase();
}

function buildStateFilter(projectsData) {
  const stateFilter = document.getElementById("stateFilter");
  if (!stateFilter) return;

  const states = [...new Set(
    projectsData
      .map(project => getProjectState(project))
      .filter(state => state !== "")
  )].sort();

  stateFilter.innerHTML = "";

  states.forEach(state => {
    const label = document.createElement("label");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = state;
    checkbox.checked = true;

    checkbox.addEventListener("change", applyFilters);

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(state));

    stateFilter.appendChild(label);
  });
}

function getSelectedStates() {
  const checkedBoxes = document.querySelectorAll("#stateFilter input[type='checkbox']:checked");
  return Array.from(checkedBoxes).map(box => box.value);
}

function getSelectedOwners() {
  const checkedBoxes = document.querySelectorAll("#ownerFilter input[type='checkbox']:checked");
  return Array.from(checkedBoxes).map(box => box.value);
}

function addProjectMarkers(filteredProjects = projects) {
  projectMarkers.forEach(marker => map.removeLayer(marker));
  projectMarkers = [];
  markerByProjectId = {};
  highlightedMarker = null;

  const bounds = [];

  filteredProjects.forEach(project => {
    const lat = Number(project["Latitude"]);
    const lng = Number(project["Longitude"]);

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

    const marker = L.circleMarker([lat, lng], {
      radius: 8,
      fillOpacity: 0.85,
      color: "#222",
      weight: 1,
      fillColor: getMarkerColor(project)
    }).addTo(map);

    marker.bindPopup(`
      <strong>${project["Project Name"]}</strong><br>
      ${project["City/State"] || ""}<br>
      GLA: ${formatNumber(project["Total GLA"])} SF<br>
      Grocery: ${project["Grocery Tenant"] || "N/A"}<br>
      Grocery % GLA: ${round(project["Grocery % GLA"], 1)}%
    `);

    marker.on("click", () => {
      showProjectDetail(project);
    });

    projectMarkers.push(marker);
    markerByProjectId[String(project["Project ID"])] = marker;
    bounds.push([lat, lng]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, {
      padding: [30, 30]
    });
  }
}

function getMarkerColor(project) {
  const gla = Number(project["Total GLA"]) || 0;

  if (gla > 100000) {
    return "#f28e2b"; // orange = over 100k SF
  }

  return "#2ca25f"; // green = under 100k SF
}

function showProjectDetail(project) {
  const projectId = String(project["Project ID"]);

  const projectTenants = tenants.filter(t =>
    String(t["Project ID"]) === projectId
  );

  const sidebar = document.getElementById("project-detail");

  sidebar.classList.remove("empty-state");

  sidebar.innerHTML = `
    <h2 class="project-title">${project["Project Name"] || ""}</h2>
    <p class="project-address">
     ${project["Owner"] ? `<strong>${project["Owner"]}</strong><br>` : ""}
     ${project["Address"] || ""}
    </p>

    <div class="button-row">
      ${pdfButton(project)}
      ${mapButton(project)}
      <button class="compare-button-small" onclick="addCompareProject('${project["Project ID"]}', event)">
       Add to Compare
     </button>
    </div>

    ${compareBarHTML()}

    <div class="metric-grid">
      ${metric("Total GLA", formatNumber(project["Total GLA"]) + " SF")}
      ${metric("Parking Count", formatNumber(project["Parking Count"]))}
      ${metric("Parking Ratio / 1,000 SF", round(project["Parking Ratio / 1000 SF"], 2))}
      ${metric("Grocery Tenant", project["Grocery Tenant"] || "N/A")}

      ${metric("Grocery SF", formatNumber(project["Grocery SF"]) + " SF")}
      ${metric("Grocery % GLA", round(project["Grocery % GLA"], 1) + "%")}

      ${metric("Food %", round(project["Food %"], 1) + "%")}
      ${metric("Soft Goods %", round(project["Soft Goods %"], 1) + "%")}
      ${metric("Hard Goods %", round(project["Hard Goods %"], 1) + "%")}
      ${metric("Service %", round(project["Service %"], 1) + "%")}

      ${metric("Vacancy %", round(project["Vacancy %"], 1) + "%")}
      ${metric("Other %", round(project["Other %"], 1) + "%")}

      ${metric("0–3k SF Tenants", project["Tenant Count 0-3k"])}
      ${metric("3k–10k SF Tenants", project["Tenant Count 3k-10k"])}
      ${metric("10k+ SF Tenants", project["Tenant Count 10k+"])}
    </div>

    ${sitePlanHTML(project)}

    ${storefrontHTML(project)}

    <h3 class="section-title">Tenant Mix Summary</h3>
    ${tenantSummaryHTML(projectTenants)}

    <h3 class="section-title">Tenant Table</h3>
    ${tenantTableHTML(projectTenants)}
  `;
}

function metric(label, value) {
  if (value === undefined || value === null || value === "NaN%" || value === "NaN SF") {
    value = "N/A";
  }

  return `
    <div class="metric">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value}</div>
    </div>
  `;
}

function sitePlanHTML(project) {
  const imagePath = project["Site Plan Image Path"];

  if (!imagePath || imagePath === 0) {
    return `<p>No site plan image available.</p>`;
  }

  return `
    <h3 class="section-title">Site Plan</h3>
    <img class="site-plan" src="${imagePath}" alt="Site Plan">
  `;
}

function openImageLightbox(imagePath) {
  const lightbox = document.getElementById("imageLightbox");
  const lightboxImg = document.getElementById("imageLightboxImg");

  if (!lightbox || !lightboxImg || !imagePath) return;

  lightboxImg.src = imagePath;
  lightbox.classList.remove("hidden");
}

function closeImageLightbox(event) {
  if (event) {
    event.stopPropagation();
  }

  const lightbox = document.getElementById("imageLightbox");
  const lightboxImg = document.getElementById("imageLightboxImg");

  if (!lightbox || !lightboxImg) return;

  lightbox.classList.add("hidden");
  lightboxImg.src = "";
}

function storefrontHTML(project) {
  const projectId = String(project["Project ID"]);

  const prototypeItem = traderJoePrototypes.find(item =>
    String(item["Project ID"]) === projectId
  );

  if (!prototypeItem) return "";

  const storefrontPath = prototypeItem["StorefrontPath"];

  if (!storefrontPath || storefrontPath === 0) return "";

  return `
    <h3 class="section-title">Storefront</h3>
    <img
      class="site-plan clickable-image"
      src="${storefrontPath}"
      alt="Storefront"
      onclick="openImageLightbox('${escapeJS(storefrontPath)}')"
    >
  `;
}

function tenantTableHTML(projectTenants) {
  if (!projectTenants.length) {
    return `<p>No tenant data available.</p>`;
  }

  const rows = projectTenants.map(t => `
    <tr>
      <td>${t["Unit"] || ""}</td>
      <td>${t["Tenant"] || ""}</td>
      <td>${formatNumber(t["Tenant SF"])}</td>
      <td>${t["Tenant Category"] || ""}</td>
      <td>${t["Main Mix Group"] || ""}</td>
    </tr>
  `).join("");

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Unit</th>
            <th>Tenant</th>
            <th>SF</th>
            <th>Category</th>
            <th>Mix Group</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function pdfButton(project) {
  const pdfPath = project["PDF Path"];

  if (!pdfPath || pdfPath === 0) return "";

  return `
    <a href="${pdfPath}" target="_blank">
      Open Marketing Package
    </a>
  `;
}

function mapButton(project) {
  const lat = project["Latitude"];
  const lng = project["Longitude"];

  if (!lat || !lng) return "";

  return `
    <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank">
      Open Google Maps
    </a>
  `;
}

function formatNumber(value) {
  if (value === undefined || value === null || value === "" || isNaN(value)) {
    return "";
  }

  return Number(value).toLocaleString();
}

function formatCurrency(value) {
  if (value === undefined || value === null || value === "" || isNaN(value)) {
    return "N/A";
  }

  return "$" + Number(value).toLocaleString();
}

function round(value, digits = 1) {
  if (value === undefined || value === null || value === "" || isNaN(value)) {
    return "";
  }

  return Number(value).toFixed(digits);
}

// tenant form
function tenantSummaryHTML(projectTenants) {
  if (!projectTenants.length) {
    return `<p>No tenant data available.</p>`;
  }

  const summary = {};

  projectTenants.forEach(t => {
    const category = t["Tenant Category"] || "Other";

    if (!summary[category]) {
      summary[category] = {
        count: 0,
        sf: 0
      };
    }

    summary[category].count += 1;
    summary[category].sf += Number(t["Tenant SF"]) || 0;
  });

  const rows = Object.entries(summary)
    .sort((a, b) => b[1].sf - a[1].sf)
    .map(([category, data]) => `
      <tr>
        <td>${category}</td>
        <td>${data.count}</td>
        <td>${formatNumber(data.sf)}</td>
      </tr>
    `)
    .join("");

  return `
    <table class="summary-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Count</th>
          <th>Total SF</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")

    // Unify curly apostrophes / quotes
    .replace(/[‘’‛`´]/g, "'")

    // Treat apostrophe-s as optional:
    // Trader Joe's / Trader Joes / Trader Joe all become close enough
    .replace(/'s\b/g, "s")

    // Treat & and + as "and"
    .replace(/&/g, " and ")
    .replace(/\+/g, " and ")

    // Remove remaining apostrophes
    .replace(/'/g, "")

    // Remove punctuation, keep letters/numbers/spaces
    .replace(/[^a-z0-9\s]/g, " ")

    // Normalize common word variants
    .replace(/\band\b/g, " and ")

    // Collapse extra spaces
    .replace(/\s+/g, " ")
    .trim();
}

function tenantMatchesSearch(tenantName, keyword) {
  const normalizedTenant = normalizeSearchText(tenantName);
  const normalizedKeyword = normalizeSearchText(keyword);

  if (!normalizedKeyword) return true;

  // Direct includes search
  if (normalizedTenant.includes(normalizedKeyword)) {
    return true;
  }

  // Also allow every word in the search to appear somewhere.
  // Example: "shop and shop" can still find "Stop & Shop" if user typo is close,
  // but mainly helps with word-order / spacing issues.
  const keywordWords = normalizedKeyword.split(" ").filter(Boolean);

  return keywordWords.every(word => normalizedTenant.includes(word));
}

function applyFilters() {
  const selectedOwners = getSelectedOwners();
  const selectedStates = getSelectedStates();
  const tenantKeywordRaw = document.getElementById("tenantSearch").value.trim();
  const tenantKeyword = normalizeSearchText(tenantKeywordRaw);

  const minGLA = getNumberInput("minGLA");
  const maxGLA = getNumberInput("maxGLA");

  const minGroceryPct = getNumberInput("minGroceryPct");
  const maxGroceryPct = getNumberInput("maxGroceryPct");

  const minVacancyPct = getNumberInput("minVacancyPct");
  const maxVacancyPct = getNumberInput("maxVacancyPct");

  let filteredProjects = [...projects];

  // Owner filter
  if (selectedOwners.length > 0) {
    filteredProjects = filteredProjects.filter(project =>
      selectedOwners.includes(
        getOwnerGroup(String(project["Owner"] || "").trim())
      )
    );
  } else {
    filteredProjects = [];
  }

  // State filter
  if (selectedStates.length > 0) {
    filteredProjects = filteredProjects.filter(project =>
      selectedStates.includes(getProjectState(project))
    );
  } else {
    filteredProjects = [];
  }

    // Tenant keyword filter
  if (tenantKeyword) {
    const matchedProjectIds = tenants
      .filter(tenant =>
        tenantMatchesSearch(tenant["Tenant"], tenantKeywordRaw)
      )
      .map(tenant => String(tenant["Project ID"]));

    const uniqueIds = new Set(matchedProjectIds);

    filteredProjects = filteredProjects.filter(project =>
      uniqueIds.has(String(project["Project ID"]))
    );
  }

  // GLA filter
  if (minGLA !== null) {
    filteredProjects = filteredProjects.filter(project =>
      Number(project["Total GLA"]) >= minGLA
    );
  }

  if (maxGLA !== null) {
    filteredProjects = filteredProjects.filter(project =>
      Number(project["Total GLA"]) <= maxGLA
    );
  }

  // Grocery percentage filter
  if (minGroceryPct !== null) {
    filteredProjects = filteredProjects.filter(project =>
      Number(project["Grocery % GLA"]) >= minGroceryPct
    );
  }

  if (maxGroceryPct !== null) {
    filteredProjects = filteredProjects.filter(project =>
      Number(project["Grocery % GLA"]) <= maxGroceryPct
    );
  }

  // Vacancy percentage filter
  if (minVacancyPct !== null) {
    filteredProjects = filteredProjects.filter(project =>
      Number(project["Vacancy %"]) >= minVacancyPct
    );
  }

  if (maxVacancyPct !== null) {
    filteredProjects = filteredProjects.filter(project =>
      Number(project["Vacancy %"]) <= maxVacancyPct
    );
  }

  addProjectMarkers(filteredProjects);

  const projectListHTML = filteredProjects.map(project => {
    const projectId = String(project["Project ID"]);

    const alreadyInCompare = compareProjects.some(compareProject =>
      String(compareProject["Project ID"]) === projectId
    );

    const smallTenantCount =
      (Number(project["Tenant Count 0-3k"]) || 0) +
      (Number(project["Tenant Count 3k-10k"]) || 0);

    return `
      <div class="filter-project-card ${alreadyInCompare ? "added-to-compare" : ""}"
           onclick="showProjectDetailFromId('${projectId}')"
           onmouseenter="highlightProjectMarker('${projectId}')"
           onmouseleave="resetProjectMarker('${projectId}')">
        <h3>${project["Project Name"] || ""}</h3>
        <p>
          ${project["Owner"] || ""}
          ${project["City/State"] ? " · " + project["City/State"] : ""}
        </p>

        <div class="filter-metrics">
          <div><strong>GLA:</strong> ${formatNumber(project["Total GLA"])} SF</div>
          <div><strong>Grocery:</strong> ${project["Grocery Tenant"] || "N/A"}</div>
          <div><strong>Grocery SF:</strong> ${formatNumber(project["Grocery SF"])} SF</div>
          <div><strong>Grocery %:</strong> ${round(project["Grocery % GLA"], 1)}%</div>
          <div><strong>Tenants &lt;10k SF:</strong> ${smallTenantCount}</div>
          <div><strong>Vacancy SF:</strong> ${formatNumber(project["Vacancy"])}</div>
          <div><strong>Vacancy %:</strong> ${round(project["Vacancy %"], 1)}%</div>
        </div>

        <button class="compare-button-small"
                onclick="addCompareProject('${projectId}', event)"
                ${alreadyInCompare ? "disabled" : ""}>
          ${alreadyInCompare ? "Added to Compare" : "Add to Compare"}
        </button>
      </div>
    `;
  }).join("");

  const projectDetail = document.getElementById("project-detail");
  projectDetail.classList.remove("empty-state");

  projectDetail.innerHTML = `
    <h2>Filter Result</h2>
    <p><strong>${filteredProjects.length}</strong> projects found.</p>

    <div class="filter-note">
      ${selectedOwners.length ? `Owner: <strong>${selectedOwners.join(", ")}</strong><br>` : "Owner: <strong>None selected</strong><br>"}
      ${selectedStates.length ? `State: <strong>${selectedStates.join(", ")}</strong><br>` : "State: <strong>None selected</strong><br>"}
      ${tenantKeywordRaw ? `Tenant contains: <strong>${tenantKeywordRaw}</strong><br>` : ""}
      ${minGLA !== null ? `Min GLA: <strong>${formatNumber(minGLA)}</strong><br>` : ""}
      ${maxGLA !== null ? `Max GLA: <strong>${formatNumber(maxGLA)}</strong><br>` : ""}
      ${minGroceryPct !== null ? `Min Grocery %: <strong>${minGroceryPct}%</strong><br>` : ""}
      ${maxGroceryPct !== null ? `Max Grocery %: <strong>${maxGroceryPct}%</strong><br>` : ""}
      ${minVacancyPct !== null ? `Min Vacancy %: <strong>${minVacancyPct}%</strong><br>` : ""}
      ${maxVacancyPct !== null ? `Max Vacancy %: <strong>${maxVacancyPct}%</strong>` : ""}
    </div>

    ${compareBarHTML()}

    <div class="filter-result-list">
      ${projectListHTML}
    </div>
  `;
}

function getNumberInput(id) {
  const value = document.getElementById(id).value;

  if (value === "") {
    return null;
  }

  return Number(value);
}


function showProjectDetailFromId(projectId) {
  const project = projects.find(p => String(p["Project ID"]) === String(projectId));

  if (project) {
    showProjectDetail(project);
  }
}

function highlightProjectMarker(projectId) {
  const marker = markerByProjectId[String(projectId)];

  if (!marker) return;

  highlightedMarker = marker;

  marker.setStyle({
    radius: 14,
    weight: 4,
    color: "#000",
    fillOpacity: 1
  });

  marker.bringToFront();
  marker.openPopup();
}

function resetProjectMarker(projectId) {
  const marker = markerByProjectId[String(projectId)];

  if (!marker) return;

  const project = projects.find(p => String(p["Project ID"]) === String(projectId));

  marker.setStyle({
    radius: 8,
    weight: 1,
    color: "#222",
    fillOpacity: 0.85,
    fillColor: getMarkerColor(project)
  });

  marker.closePopup();

  highlightedMarker = null;
}

function clearFilter() {
  document.getElementById("tenantSearch").value = "";
  document.getElementById("minGLA").value = "";
  document.getElementById("maxGLA").value = "";
  document.getElementById("minGroceryPct").value = "";
  document.getElementById("maxGroceryPct").value = "";
  document.getElementById("minVacancyPct").value = "";
  document.getElementById("maxVacancyPct").value = "";

  document.querySelectorAll("#ownerFilter input[type='checkbox']").forEach(input => {
    input.checked = true;
  });

  document.querySelectorAll("#stateFilter input[type='checkbox']").forEach(input => {
    input.checked = true;
  });

  addProjectMarkers(projects);

  document.getElementById("project-detail").innerHTML = `
    <div class="empty-state">
      Select a project on the map.
    </div>
  `;
}

function addCompareProject(projectId, event) {
  if (event) {
    event.stopPropagation();
  }

  const project = projects.find(p => String(p["Project ID"]) === String(projectId));

  if (!project) return;

  const alreadyAdded = compareProjects.some(p =>
    String(p["Project ID"]) === String(projectId)
  );

  if (alreadyAdded) {
    alert("This project is already in the comparison.");
    return;
  }

  if (compareProjects.length >= MAX_COMPARE_PROJECTS) {
    alert(`You can compare up to ${MAX_COMPARE_PROJECTS} projects at a time.`);
    return;
  }

  compareProjects.push(project);
  refreshCompareBar();
  refreshFilterResultCards();
}

function isProjectInCompare(projectId) {
  return compareProjects.some(project =>
    String(project["Project ID"]) === String(projectId)
  );
}

function removeCompareProject(projectId, event) {
  if (event) {
    event.stopPropagation();
  }

  compareProjects = compareProjects.filter(p =>
    String(p["Project ID"]) !== String(projectId)
  );

  refreshCompareBar();
  refreshFilterResultCards();

  if (!document.getElementById("compareView").classList.contains("hidden")) {
    renderCompareView();
  }
}

function clearCompareProjects(event) {
  if (event) {
    event.stopPropagation();
  }

  compareProjects = [];
  refreshCompareBar();
  refreshFilterResultCards();

  if (!document.getElementById("compareView").classList.contains("hidden")) {
    renderCompareView();
  }
}

function compareBarHTML() {
  if (!compareProjects.length) {
    return `
      <div class="compare-bar">
        <h3>Compare Projects</h3>
        <div class="compare-selected-list">
          No projects selected yet. Use “Add to Compare” from the filter results or project detail.
        </div>
      </div>
    `;
  }

  const selectedNames = compareProjects
    .map(project => `
      <div>
        ${project["Project Name"] || "Unnamed Project"}
        <button class="remove-compare-btn"
                onclick="removeCompareProject('${project["Project ID"]}', event)">
          ✕
        </button>
      </div>
    `)
    .join("");

  return `
    <div class="compare-bar">
      <h3>Compare Projects</h3>

      <div class="compare-selected-list">
        <strong>${compareProjects.length}</strong> selected:
        ${selectedNames}
      </div>

      <div class="compare-bar-buttons">
        <button onclick="openCompareView()">Open Compare View</button>
        <button class="secondary" onclick="clearCompareProjects(event)">Clear Compare</button>
      </div>
    </div>
  `;
}

function refreshCompareBar() {
  const detail = document.getElementById("project-detail");
  if (!detail) return;

  const existingCompareBar = detail.querySelector(".compare-bar");

  if (existingCompareBar) {
    existingCompareBar.outerHTML = compareBarHTML();
  }
}

function refreshFilterResultCards() {
  const detail = document.getElementById("project-detail");

  if (!detail) return;

  const filterTitle = detail.querySelector("h2");

  if (filterTitle && filterTitle.textContent === "Filter Result") {
    applyFilters();
  }
}

function openCompareView() {
  if (compareProjects.length < 2) {
    alert("Please select at least 2 projects to compare.");
    return;
  }

  document.getElementById("app").style.display = "none";
  document.getElementById("compareView").classList.remove("hidden");

  renderCompareView();
}

function closeCompareView() {
  document.getElementById("compareView").classList.add("hidden");
  document.getElementById("app").style.display = "flex";

  // Recalculate the main map size after returning
  setTimeout(() => {
    map.invalidateSize();
  }, 100);
}

function renderCompareView() {
  const compareGrid = document.getElementById("compareGrid");

  // Remove old mini maps first
  compareMiniMaps.forEach(miniMap => {
    miniMap.remove();
  });
  compareMiniMaps = [];

  if (!compareProjects.length) {
    compareGrid.innerHTML = `<p>No projects selected.</p>`;
    return;
  }

  compareGrid.innerHTML = compareProjects.map(project => {
    const projectId = String(project["Project ID"]);
    const mapId = `compare-map-${safeId(projectId)}`;

    const projectTenants = tenants.filter(t =>
      String(t["Project ID"]) === projectId
    );

    return `
      <div class="compare-card">
        <div class="compare-card-header">
          <h3>${project["Project Name"] || ""}</h3>
          <p>
            ${project["Owner"] || ""}<br>
            ${project["Address"] || ""}<br>
            ${project["City/State"] || ""}
          </p>
        </div>

        ${compareSitePlanHTML(project)}

        <div id="${mapId}" class="compare-mini-map"></div>

        <div class="compare-metrics">
          ${compareMetricRow("Total GLA", formatNumber(project["Total GLA"]) + " SF")}
          ${compareMetricRow("Year Built", project["Year Built"] || "N/A")}
          ${compareMetricRow("5-Mile Population", formatNumber(project["5-Mile Population"]))}
          ${compareMetricRow("5-Mile Income", formatCurrency(project["5-Mile Income"]))}

          ${compareMetricRow("Grocery Tenant", project["Grocery Tenant"] || "N/A")}
          ${compareMetricRow("Grocery SF", formatNumber(project["Grocery SF"]) + " SF")}
          ${compareMetricRow("Grocery % GLA", round(project["Grocery % GLA"], 1) + "%")}

          ${compareMetricRow("Parking Count", formatNumber(project["Parking Count"]))}
          ${compareMetricRow("Parking Ratio / 1,000 SF", round(project["Parking Ratio / 1000 SF"], 2))}
          ${compareMetricRow("Vacancy %", round(project["Vacancy %"], 1) + "%")}

          ${compareMetricRow("Food %", round(project["Food %"], 1) + "%")}
          ${compareMetricRow("Soft Goods %", round(project["Soft Goods %"], 1) + "%")}
          ${compareMetricRow("Hard Goods %", round(project["Hard Goods %"], 1) + "%")}
          ${compareMetricRow("Service %", round(project["Service %"], 1) + "%")}
          ${compareMetricRow("Other %", round(project["Other %"], 1) + "%")}

          ${compareMetricRow("0–3k SF Tenants", project["Tenant Count 0-3k"])}
          ${compareMetricRow("3k–10k SF Tenants", project["Tenant Count 3k-10k"])}
          ${compareMetricRow("10k+ SF Tenants", project["Tenant Count 10k+"])}
        </div>

        <div class="compare-tenant-section">
          <h4>Tenant Mix Summary</h4>
          ${tenantSummaryHTML(projectTenants)}
        </div>

        <div class="compare-tenant-section">
          <h4>Tenant Table</h4>
          ${tenantTableHTML(projectTenants)}
        </div>
      </div>
    `;
  }).join("");

  // Wait until cards are actually drawn, then initialize maps
  setTimeout(() => {
    initializeCompareMiniMaps();
  }, 300);
}

function initializeCompareMiniMaps() {
  compareProjects.forEach(project => {
    const lat = Number(project["Latitude"]);
    const lng = Number(project["Longitude"]);

    const projectId = String(project["Project ID"]);
    const mapId = `compare-map-${safeId(projectId)}`;
    const mapElement = document.getElementById(mapId);

    if (!mapElement) return;

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      mapElement.innerHTML = `
        <div class="compare-no-map">
          No map location available
        </div>
      `;
      return;
    }

    const miniMap = L.map(mapId, {
      zoomControl: true,
      attributionControl: true,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      touchZoom: true
    }).setView([lat, lng], 18);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "Tiles © Esri"
      }
    ).addTo(miniMap);

    L.circleMarker([lat, lng], {
      radius: 8,
      fillOpacity: 0.95,
      color: "#222",
      weight: 1,
      fillColor: getMarkerColor(project)
    }).addTo(miniMap);

    compareMiniMaps.push(miniMap);

    setTimeout(() => {
      miniMap.invalidateSize();
    }, 500);
  });
}

function sitePlanHTML(project) {
  const imagePath = project["Site Plan Image Path"];

  if (!imagePath || imagePath === 0) {
    return `<p>No site plan image available.</p>`;
  }

  return `
    <h3 class="section-title">Site Plan</h3>
    <img
      class="site-plan clickable-image"
      src="${imagePath}"
      alt="Site Plan"
      onclick="openImageLightbox('${escapeJS(imagePath)}')"
    >
  `;
}

function compareMetricRow(label, value) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "NaN%" ||
    value === "NaN SF"
  ) {
    value = "N/A";
  }

  return `
    <div class="compare-metric-row">
      <div class="compare-metric-label">${label}</div>
      <div class="compare-metric-value">${value}</div>
    </div>
  `;
}

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "-");
}

function checkAllStates() {
  document.querySelectorAll("#stateFilter input[type='checkbox']")
    .forEach(cb => cb.checked = true);
}

function uncheckAllStates() {
  document.querySelectorAll("#stateFilter input[type='checkbox']")
    .forEach(cb => cb.checked = false);
}

function checkAllOwners() {
  document.querySelectorAll("#ownerFilter input[type='checkbox']")
    .forEach(cb => cb.checked = true);
}

function uncheckAllOwners() {
  document.querySelectorAll("#ownerFilter input[type='checkbox']")
    .forEach(cb => cb.checked = false);
}

function enterFromLanding(viewName) {
  const landingPage = document.getElementById("landingPage");

  if (landingPage) {
    landingPage.classList.add("landing-hidden");
  }

  if (viewName === "map") {
    showMapView();
  }

  if (viewName === "matrix") {
    showPrototypeView();
  }

  if (viewName === "draw") {
    showDrawView();
  }
}

function showMapView() {
  document.body.classList.remove("prototype-mode");

  document.getElementById("topNav").style.display = "flex";
  document.getElementById("app").style.display = "flex";
  document.getElementById("prototypeView").classList.add("hidden");
  document.getElementById("compareView").classList.add("hidden");
  document.getElementById("drawView").classList.add("hidden");

  document.getElementById("mapViewBtn").classList.add("active");
  document.getElementById("prototypeViewBtn").classList.remove("active");
  document.getElementById("drawViewBtn").classList.remove("active");

  setTimeout(() => {
    map.invalidateSize();
  }, 100);
}

function setMatrixMode(mode) {
  if (!matrixModeConfig[mode]) return;

  prototypeDisplayMode = "matrix";
  setPrototypePanelsVisible(true);

  const coTenantBtn = document.getElementById("coTenantTableBtn");
  if (coTenantBtn) {
    coTenantBtn.textContent = "Show Co-Tenant Table";
    coTenantBtn.classList.remove("active");
  }

  const adjacentTenantBtn = document.getElementById("adjacentTenantTableBtn");
  if (adjacentTenantBtn) {
   adjacentTenantBtn.textContent = "Show Adjacent Tenant Table";
   adjacentTenantBtn.classList.remove("active");
  }

  matrixMode = mode;

  const subtitle = document.getElementById("prototypeMatrixSubtitle");
  if (subtitle) {
    subtitle.textContent = matrixModeConfig[matrixMode].subtitle;
  }

  const panelTitle = document.getElementById("matrixCategoryPanelTitle");
  if (panelTitle) {
    panelTitle.textContent = `${matrixModeConfig[matrixMode].label} Categories`;
  }

  renderMatrixModeToggle();
  renderPrototypeTypeFilter();
  renderMatrixHighlightOptions();
  renderPrototypeView();
}

function renderMatrixModeToggle() {
  const toggle = document.getElementById("matrixModeToggle");
  if (!toggle) return;

  toggle.innerHTML = Object.entries(matrixModeConfig).map(([mode, config]) => {
    const active = matrixMode === mode ? "active" : "";

    return `
      <button class="${active}"
              data-tooltip="${escapeAttribute(config.tooltip)}"
              onclick="setMatrixMode('${mode}')">
        ${config.label}
      </button>
    `;
  }).join("");
}

function toggleMatrixCardCompact() {
  matrixCardsCompact = !matrixCardsCompact;

  const btn = document.getElementById("matrixCompactToggleBtn");

  if (btn) {
    btn.textContent = matrixCardsCompact ? "Expand Cards" : "Collapse Cards";
    btn.classList.toggle("active", matrixCardsCompact);
  }

  renderPrototypeView();
}

function toggleMatrixImageMode() {
  matrixImageMode = matrixImageMode === "siteplan" ? "storefront" : "siteplan";

  const btn = document.getElementById("matrixImageToggleBtn");

  if (btn) {
    btn.textContent = matrixImageMode === "siteplan"
      ? "Show Storefront"
      : "Show Site Plan";

    btn.classList.toggle("active", matrixImageMode === "storefront");
  }

  renderPrototypeView();
}

function toggleMatrixHighlightValue(field, value, checked) {
  if (!matrixHighlightSelections[field]) {
    matrixHighlightSelections[field] = [];
  }

  if (checked) {
    if (!matrixHighlightSelections[field].includes(value)) {
      matrixHighlightSelections[field].push(value);
    }
  } else {
    matrixHighlightSelections[field] = matrixHighlightSelections[field].filter(item =>
      item !== value
    );
  }

  renderPrototypeView();
}

function clearMatrixHighlight() {
  Object.keys(matrixHighlightSelections).forEach(field => {
    matrixHighlightSelections[field] = [];
  });

  renderMatrixHighlightOptions();
  renderPrototypeView();
}

function renderMatrixHighlightOptions() {
  const container = document.getElementById("matrixHighlightOptions");
  if (!container) return;

  const highlightModes = [
    "layout",
    "typology",
    "position",
    "parking",
    "visibility",
    "size",
    "storefront",
    "residential"
  ];

  container.innerHTML = highlightModes.map(mode => {
    const config = matrixModeConfig[mode];
    const selectedValues = matrixHighlightSelections[mode] || [];

    return `
      <div class="matrix-highlight-group">
        <div class="matrix-highlight-group-title">
          ${config.label}
        </div>

        <div class="matrix-highlight-checkboxes">
          ${config.order.map(value => `
            <label>
              <input
                type="checkbox"
                value="${value}"
                ${selectedValues.includes(value) ? "checked" : ""}
                onchange="toggleMatrixHighlightValue('${mode}', '${escapeAttribute(value)}', this.checked)"
              >
              ${value}
            </label>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function isMatrixHighlightActive() {
  return Object.values(matrixHighlightSelections).some(values =>
    values && values.length > 0
  );
}

function cardMatchesMatrixHighlight(item) {
  if (!isMatrixHighlightActive()) return false;

  return Object.entries(matrixHighlightSelections).every(([field, selectedValues]) => {
    if (!selectedValues || selectedValues.length === 0) {
      return true;
    }

    const itemValue = getItemValueForMatrixField(item, field);

    return selectedValues.some(value =>
      normalizeMatrixValue(itemValue) === normalizeMatrixValue(value)
    );
  });
}

function getItemValueForMatrixField(item, field) {
  if (field === "layout") {
    return item["Prototype"] || "";
  }

  if (field === "typology") {
    return item["TypologyOfCenter"] || "";
  }

  if (field === "position") {
    return item["TraderJoesPosition"] || "";
  }

  if (field === "parking") {
    return item["ParkingLocation"] || "";
  }

  if (field === "visibility") {
    return item["TJVisibilityToMainRoad"] || "";
  }

  if (field === "size") {
    return getTJSizeBucket(item["TJSize"]);
  }

  if (field === "storefront") {
    return item["Storefront"] || "";
  }

  if (field === "residential") {
    return item["ResidentialRelationship"] || "";
  }

  return "";
}






function escapeAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function showPrototypeView() {
  document.body.classList.add("prototype-mode");

  document.getElementById("topNav").style.display = "flex";
  document.getElementById("app").style.display = "none";
  document.getElementById("compareView").classList.add("hidden");
  document.getElementById("drawView").classList.add("hidden");
  document.getElementById("prototypeView").classList.remove("hidden");

  document.getElementById("mapViewBtn").classList.remove("active");
  document.getElementById("prototypeViewBtn").classList.add("active");
  document.getElementById("drawViewBtn").classList.remove("active");

  prototypeDisplayMode = "matrix";
  setPrototypePanelsVisible(true);

  const coTenantBtn = document.getElementById("coTenantTableBtn");
  if (coTenantBtn) {
    coTenantBtn.textContent = "Show Co-Tenant Table";
    coTenantBtn.classList.remove("active");
  }

  const adjacentTenantBtn = document.getElementById("adjacentTenantTableBtn");
  if (adjacentTenantBtn) {
    adjacentTenantBtn.textContent = "Show Adjacent Tenant Table";
    adjacentTenantBtn.classList.remove("active");
  }

  renderMatrixModeToggle();
  renderPrototypeTypeFilter();
  renderMatrixHighlightOptions();
  renderPrototypeView();

  // Trigger entrance / scroll animation after content is rendered
  requestAnimationFrame(() => {
    initPrototypeScrollReveal();
  });
}

function getLayoutPrototypeDescription(typeName) {
  const descriptions = {
    "Urban Context":
      "Located in a denser urban block or mixed-use district. Trader Joe’s is often near a street corner or key intersection, but not always occupying the exact corner space.",

    "Standalone":
      "A small-format site with Trader Joe’s as the primary tenant, sometimes with only one or two small adjacent retailers. It functions as a quick in-and-out grocery stop rather than a larger shopping destination.",

    "Mall / Destination":
      "Located within or next to a mall, lifestyle destination, or larger retail center. Trader Joe’s benefits from surrounding destination traffic rather than operating as a standalone neighborhood store.",

    "Branch":
      "Organized around an internal drive aisle that branches into separate parking areas. Visitors enter the site, then navigate toward the specific tenant and its corresponding parking field.",

    "Spine":
      "Organized around a main internal spine between the buildings and the parking field. Larger anchors are often in the middle, with smaller shops toward the ends. Trader Joe’s is usually positioned between a big-box anchor and smaller retail spaces.",

    "C-Shape":
      "Buildings form a C-shaped layout around a central parking field. The main internal drive sits between the buildings and parking. Larger tenants often face the primary road, while smaller shops line the sides. Trader Joe’s is often aligned with the main entrance sequence.",

    "Cluster":
      "Multiple building clusters share a common central parking field, but additional parking is often placed behind the buildings to meet demand. Larger anchors usually face the main road, while smaller grocery or food tenants occupy side clusters. Trader Joe’s is often located deep within the left-side building group."
  };

  return descriptions[typeName] || "";
}

function getCenterTypologyDescription(typeName) {
  const descriptions = {
    "Urban":
      "Dense city or downtown context, usually with smaller parking supply, walkable blocks, transit access, and stronger street-front retail conditions.",

    "Inner Suburban":
      "Mature close-in suburb or urban-edge corridor. More auto-oriented than urban retail, but denser and more connected than typical suburban shopping centers.",

    "Suburban":
      "Auto-oriented suburban retail environment with surface parking, larger setbacks, lower surrounding density, and primary access by car.",

    "Lifestyle":
      "Walkable destination retail with restaurants, food, entertainment, public space, and an outdoor mall-like experience.",

    "Power":
      "Low-frequency big-box retail cluster, usually dominated by utilitarian anchors such as home improvement, furniture, electronics, sporting goods, or similar large-format stores.",

    "Town Center":
      "A main-street or village-center environment with a stronger civic, mixed-use, or community-center character.",

    "Convenience / Neighborhood":
      "Small daily-needs retail center serving nearby residents, often anchored by grocery, pharmacy, coffee, salon, small restaurants, or local services."
  };

  return descriptions[typeName] || "";
}

function getMatrixTypeDescription(typeName) {
  if (matrixMode === "layout") {
    return getLayoutPrototypeDescription(typeName);
  }

  if (matrixMode === "typology") {
    return getCenterTypologyDescription(typeName);
  }

  if (matrixMode === "position") {
    return getTJPositionDescription(typeName);
  }

  if (matrixMode === "parking") {
    return getParkingLocationDescription(typeName);
  }

  if (matrixMode === "visibility") {
    return getVisibilityDescription(typeName);
  }

  if (matrixMode === "size") {
    return getTJSizeDescription(typeName);
  }

  if (matrixMode === "storefront") {
    return getStorefrontDescription(typeName);
  }

  if (matrixMode === "residential") {
    return getResidentialRelationshipDescription(typeName);
  }

  return "";
}

function getTJPositionDescription(typeName) {
  const descriptions = {
    "Urban Block":
      "Trader Joe’s is located within an urban block or mixed-use building rather than a conventional shopping center layout.",

    "Freestanding / Pad":
      "Trader Joe’s occupies a freestanding building or pad-like building separated from the main retail block.",

    "Major Anchor":
      "Trader Joe’s functions as one of the main traffic-driving anchors in the center.",

    "Junior Anchor":
      "Trader Joe’s has anchor-like size or importance, but sits alongside larger or more dominant anchors.",

    "End Cap":
      "Trader Joe’s is located at the end of a continuous retail row or strip.",

    "Inline":
      "Trader Joe’s is inserted within a continuous storefront line, with other tenants on both sides."
  };

  return descriptions[typeName] || "";
}

function getParkingLocationDescription(typeName) {
  const descriptions = {
    "Front Field":
      "Customer parking is directly in front of Trader Joe’s entrance.",

    "Side Field":
      "The closest parking is mainly located to the side of Trader Joe’s.",

    "Shared Field":
      "Trader Joe’s faces or uses a common surface parking field shared with multiple tenants.",

    "Structured":
      "Customer parking is primarily provided in a garage or structured parking facility.",

    "Rear / Integrated":
      "Parking is located behind, underneath, integrated with, or distributed around the building/site."
  };

  return descriptions[typeName] || "";
}

function getVisibilityDescription(typeName) {
  const descriptions = {
    "Yes":
      "Trader Joe’s facade, entrance, or signage is clearly visible from the main road.",

    "No":
      "Trader Joe’s is not clearly visible from the main road and is only seen after entering the site or internal circulation."
  };

  return descriptions[typeName] || "";
}

function getTJSizeDescription(typeName) {
  const descriptions = {
    "Under 10k":
      "Trader Joe’s store area is below 10,000 SF.",

    "10k–12k":
      "Trader Joe’s store area is between 10,000 and 12,000 SF.",

    "12k–15k":
      "Trader Joe’s store area is between 12,000 and 15,000 SF.",

    "15k–18k":
      "Trader Joe’s store area is between 15,000 and 18,000 SF.",

    "18k+":
      "Trader Joe’s store area is 18,000 SF or larger."
  };

  return descriptions[typeName] || "";
}

function getStorefrontDescription(typeName) {
  const descriptions = {
    "Urban Storefront":
      "Embedded in an urban block, mixed-use building, or street-front retail condition. The storefront is usually defined by signage and ground-floor entry rather than a full suburban facade.",

    "Flat Parapet Storefront":
      "A flat facade with a raised parapet or sign band, often paired with red awnings or canopy elements. This is the most typical suburban strip-center storefront expression.",

    "Gabled / Pitched-Roof Storefront":
      "A storefront with a pitched roof, gable, or triangular front element. The roof form gives the store a more neighborhood-scale or residential-like character.",

    "Decorative Storefront":
      "A storefront with added architectural expression such as arches, curved parapets, cornices, pilasters, towers, brick detailing, or other traditional decorative elements.",

    "Contemporary Entrance Tower":
      "A storefront where the main entrance is emphasized by a taller vertical tower or pavilion, often combined with contemporary materials such as glass, metal panels, and clean facade lines.",

    "Custom Storefront":
      "A highly customized or themed storefront designed for a specific shopping village, historic setting, or unique project identity rather than following a standard Trader Joe’s facade pattern."
  };

  return descriptions[typeName] || "";
}

function getResidentialRelationshipDescription(typeName) {
  const descriptions = {
    "No Multifamily Within 1000 ft":
      "No multifamily residential use is located within approximately 1,000 ft of Trader Joe’s. The surrounding context is primarily commercial, office, industrial, highway-oriented, mall-oriented, or low-density residential.",

    "Acceptable Connection":
      "Multifamily residential is nearby, but the connection to Trader Joe’s is limited or not especially pedestrian-friendly. The route may rely on drive aisles, wide internal roads, parking fields, service edges, loading/back-of-house areas, or indirect circulation.",

    "Nice Connection":
      "Multifamily residential is nearby and has a relatively comfortable connection to Trader Joe’s, such as a continuous sidewalk, pedestrian-friendly road, marked crossing, internal path, plaza, or clear front-door access sequence."
  };

  return descriptions[typeName] || "";
}

function renderPrototypeView() {
  const prototypeGrid = document.getElementById("prototypeGrid");
  if (!prototypeGrid) return;

  const config = matrixModeConfig[matrixMode];
  const order = config.order;
  const selectedTypes = selectedMatrixTypes[matrixMode];

  const visibleTypes = order.filter(type =>
    selectedTypes.includes(type)
  );

  if (!visibleTypes.length) {
    prototypeGrid.style.setProperty("--prototype-column-count", 1);
    prototypeGrid.innerHTML = `
      <div class="prototype-empty-state reveal-on-scroll">
        Select at least one type to view the matrix.
      </div>
    `;

    requestAnimationFrame(() => {
      initPrototypeScrollReveal();
    });

    return;
  }

  prototypeGrid.style.setProperty("--prototype-column-count", visibleTypes.length);

  let cardIndex = 0;

  const stickyTitlesHTML = `
    <div class="matrix-sticky-title-row">
      ${visibleTypes.map(typeName => `
        <div class="matrix-sticky-title-cell">
          ${typeName}
        </div>
      `).join("")}
    </div>
  `;

  const columnsHTML = `
    <div class="matrix-columns-grid">
      ${visibleTypes.map((typeName, columnIndex) => {
        const items = getMatrixItemsByType(typeName);

        const cardsHTML = items
          .map(item => prototypeProjectCardHTML(item, cardIndex++))
          .join("");

        return `
          <div class="prototype-column"
               style="--reveal-delay: ${columnIndex * 70}ms;">
            <div class="prototype-column-header">
              ${config.showDiagram ? prototypeDiagramHTML(typeName) : ""}

              <p class="prototype-type-description">
                ${getMatrixTypeDescription(typeName)}
              </p>
            </div>

            <div class="prototype-card-list">
              ${cardsHTML || `<p class="prototype-empty reveal-on-scroll">No projects yet.</p>`}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  prototypeGrid.innerHTML = stickyTitlesHTML + columnsHTML;

  requestAnimationFrame(() => {
    initPrototypeScrollReveal();
  });
}

function toggleCoTenantTable() {
  if (prototypeDisplayMode === "cotenant") {
    prototypeDisplayMode = "matrix";
    setPrototypePanelsVisible(true);

    const btn = document.getElementById("coTenantTableBtn");
    if (btn) {
      btn.textContent = "Show Co-Tenant Table";
      btn.classList.remove("active");
    }

    const subtitle = document.getElementById("prototypeMatrixSubtitle");
    if (subtitle) {
      subtitle.textContent = matrixModeConfig[matrixMode].subtitle;
    }

    renderPrototypeView();
    return;
  }

  prototypeDisplayMode = "cotenant";
  coTenantTableMode = "frequency";
  setPrototypePanelsVisible(false);

  const btn = document.getElementById("coTenantTableBtn");
  if (btn) {
    btn.textContent = "Back to Matrix";
    btn.classList.add("active");
  }

  const adjacentTenantBtn = document.getElementById("adjacentTenantTableBtn");
  if (adjacentTenantBtn) {
    adjacentTenantBtn.textContent = "Show Adjacent Tenant Table";
    adjacentTenantBtn.classList.remove("active");
  }

  const subtitle = document.getElementById("prototypeMatrixSubtitle");
  if (subtitle) {
    subtitle.textContent =
      "Tenants that most frequently appear together with Trader Joe’s across the prototype dataset";
  }

  renderCoTenantTable();
}

function setPrototypePanelsVisible(visible) {
  const categoryPanel = document.querySelector(".matrix-category-panel");
  const highlightPanel = document.querySelector(".matrix-highlight-panel");

  if (categoryPanel) {
    categoryPanel.style.display = visible ? "" : "none";
  }

  if (highlightPanel) {
    highlightPanel.style.display = visible ? "" : "none";
  }
}

function renderCoTenantTable() {
  clearAdjacentCharts();

  const prototypeGrid = document.getElementById("prototypeGrid");
  if (!prototypeGrid) return;

  if (coTenantTableMode === "category") {
    renderCategorySummaryTable();
    return;
  }

  if (!tjCoTenants || !tjCoTenants.length) {
    prototypeGrid.innerHTML = `
      <div class="co-tenant-table-wrap">
        <p>No co-tenant data loaded. Check WithinCenter/tj_co_tenants_rechecked.csv.</p>
      </div>
    `;
    return;
  }

  const rows = [...tjCoTenants]
    .sort((a, b) => {
      const rankA = Number(a["Rank"]) || 9999;
      const rankB = Number(b["Rank"]) || 9999;
      return rankA - rankB;
    })
    .map(row => `
      <tr>
        <td class="co-tenant-rank">${row["Rank"] || ""}</td>
        <td class="co-tenant-name">${row["Tenant"] || ""}</td>
        <td class="co-tenant-category">${getCoTenantPrimaryCategory(row)}</td>
        <td class="co-tenant-count">${row["Appears in TJ Centers"] || ""}</td>
        <td>${coTenantProjectLinksHTML(row)}</td>
      </tr>
    `)
    .join("");

  prototypeGrid.innerHTML = `
    <div class="co-tenant-table-wrap">
      ${coTenantTableTabsHTML()}

      <div class="co-tenant-table-header">
        <h3>Trader Joe’s Co-Tenant Frequency</h3>
        <p>
          Ranked tenants that appear in the same retail centers as Trader Joe’s.
          Click any project name to open it in the Filter Map.
        </p>
      </div>

      <table class="co-tenant-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Tenant Name</th>
            <th>Category</th>
            <th>Appears Time</th>
            <th>Project Name</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function toggleAdjacentTenantTable() {
  if (prototypeDisplayMode === "adjacent") {
    prototypeDisplayMode = "matrix";
    setPrototypePanelsVisible(true);

    const btn = document.getElementById("adjacentTenantTableBtn");
    if (btn) {
      btn.textContent = "Show Adjacent Tenant Table";
      btn.classList.remove("active");
    }

    const subtitle = document.getElementById("prototypeMatrixSubtitle");
    if (subtitle) {
      subtitle.textContent = matrixModeConfig[matrixMode].subtitle;
    }

    renderPrototypeView();
    return;
  }

  prototypeDisplayMode = "adjacent";
  adjacentTenantTableMode = "category";
  setPrototypePanelsVisible(false);

  const adjacentBtn = document.getElementById("adjacentTenantTableBtn");
  if (adjacentBtn) {
    adjacentBtn.textContent = "Back to Matrix";
    adjacentBtn.classList.add("active");
  }

  const coTenantBtn = document.getElementById("coTenantTableBtn");
  if (coTenantBtn) {
    coTenantBtn.textContent = "Show Co-Tenant Table";
    coTenantBtn.classList.remove("active");
  }

  const subtitle = document.getElementById("prototypeMatrixSubtitle");
  if (subtitle) {
    subtitle.textContent =
      "Tenants directly adjacent to Trader Joe’s, summarized by store, category, and layout prototype";
  }

  renderAdjacentTenantTable();
}

function adjacentTenantTableTabsHTML() {
  return `
    <div class="co-tenant-tabs adjacent-tenant-tabs">
      <button
        class="${adjacentTenantTableMode === "category" ? "active" : ""}"
        onclick="setAdjacentTenantTableMode('category')">
        Category Ranking
      </button>

      <button
        class="${adjacentTenantTableMode === "store" ? "active" : ""}"
        onclick="setAdjacentTenantTableMode('store')">
        Store Ranking
      </button>

      <button
        class="${adjacentTenantTableMode === "immediate" ? "active" : ""}"
        onclick="setAdjacentTenantTableMode('immediate')">
        Immediate Only
      </button>

      <button
        class="${adjacentTenantTableMode === "summary" ? "active" : ""}"
        onclick="setAdjacentTenantTableMode('summary')">
        Layout Summary
      </button>

      <button
        class="${adjacentTenantTableMode === "layoutCategory" ? "active" : ""}"
        onclick="setAdjacentTenantTableMode('layoutCategory')">
        Layout × Category
      </button>

    </div>
  `;
}

function setAdjacentTenantTableMode(mode) {
  adjacentTenantTableMode = mode;
  renderAdjacentTenantTable();
}

function renderAdjacentPrototypeSummaryTable() {
  const prototypeGrid = document.getElementById("prototypeGrid");
  if (!prototypeGrid) return;

  if (!tjAdjacentPrototypeTopSummary || !tjAdjacentPrototypeTopSummary.length) {
    prototypeGrid.innerHTML = `
      <div class="co-tenant-table-wrap adjacent-table-wrap">
        ${adjacentTenantTableTabsHTML()}
        <p>No adjacent tenant summary data loaded.</p>
      </div>
    `;
    return;
  }

  function getPrototypeProjectCount(prototypeName) {
    return traderJoePrototypes.filter(item =>
      normalizePrototypeName(item["Prototype"]) === normalizePrototypeName(prototypeName)
    ).length;
  }

  const rows = [...tjAdjacentPrototypeTopSummary]
    .sort((a, b) =>
      String(a["Prototype"] || "").localeCompare(String(b["Prototype"] || ""))
    )
    .map(row => `
      <tr>
        <td class="co-tenant-name">${row["Prototype"] || ""}</td>
        <td class="co-tenant-count">${getPrototypeProjectCount(row["Prototype"])}</td>
        <td class="co-tenant-count">${row["Adjacent Tenant Records"] || ""}</td>
        <td>${row["Top Category"] || ""}</td>
        <td class="co-tenant-count">${row["Top Category Count"] || ""}</td>
        <td class="co-tenant-count">${formatPercent(row["Top Category Share"])}</td>
        <td>${row["Top Store"] || ""}</td>
      </tr>
    `)
    .join("");

  prototypeGrid.innerHTML = `
    <div class="co-tenant-table-wrap adjacent-table-wrap">
      ${adjacentTenantTableTabsHTML()}

      <div class="co-tenant-table-header">
        <h3>Trader Joe’s Adjacent Tenant Summary by Layout</h3>
        <p>
          This table summarizes the most frequent adjacent tenant category and store within each layout prototype.
          It helps test whether adjacent tenant patterns vary by layout type.
        </p>
      </div>

      <div id="layoutPieChartGrid" class="layout-pie-chart-grid"></div>

      <table class="co-tenant-table adjacent-tenant-table">
        <thead>
          <tr>
            <th>Layout Prototype</th>
            <th>Project Count</th>
            <th>Adjacent Records</th>
            <th>Top Category</th>
            <th>Category Count</th>
            <th>Category Share</th>
            <th>Top Store</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;

  requestAnimationFrame(() => {
    renderLayoutPieCharts();
  });
}

function renderLayoutPieCharts() {
  const container = document.getElementById("layoutPieChartGrid");
  if (!container) return;

  const prototypeOrder = [
    "Urban Context",
    "Standalone",
    "Mall / Destination",
    "Branch",
    "Spine",
    "C-Shape",
    "Cluster"
  ];

  const prototypes = prototypeOrder.filter(prototypeName =>
    tjAdjacentByPrototypeCategory.some(row =>
      normalizePrototypeName(row["Prototype"]) === normalizePrototypeName(prototypeName)
    )
  );

  container.innerHTML = prototypes.map(prototypeName => {
    const canvasId = `layout-pie-${safeId(prototypeName)}`;

    return `
      <div class="layout-pie-card">
        <div class="layout-pie-title">${prototypeName}</div>
        <div class="layout-pie-frame">
          <canvas id="${canvasId}"></canvas>
        </div>
      </div>
    `;
  }).join("");

  prototypes.forEach(prototypeName => {
    const rows = tjAdjacentByPrototypeCategory.filter(row =>
      normalizePrototypeName(row["Prototype"]) === normalizePrototypeName(prototypeName)
    );

    const chartRows = getTopChartRows(
      rows,
      "Adjacent Category",
      "Count",
      5
    );

    createPieChart(
      `layout-pie-${safeId(prototypeName)}`,
      chartRows.map(row => row.label),
      chartRows.map(row => row.count),
      prototypeName
    );
  });
}

function renderAdjacentCategoryFrequencyTable() {
  const prototypeGrid = document.getElementById("prototypeGrid");
  if (!prototypeGrid) return;

  const rows = [...tjAdjacentCategoryFrequency]
    .sort((a, b) => (Number(a["Rank"]) || 9999) - (Number(b["Rank"]) || 9999))
    .map(row => `
      <tr>
        <td class="co-tenant-rank">${row["Rank"] || ""}</td>
        <td class="co-tenant-name">${row["Adjacent Category"] || ""}</td>
        <td class="co-tenant-count">${row["Count"] || ""}</td>
        <td class="co-tenant-count">${formatPercent(row["Share of Adjacent Tenants"])}</td>
      </tr>
    `)
    .join("");

  prototypeGrid.innerHTML = `
    <div class="co-tenant-table-wrap adjacent-table-wrap">
      ${adjacentTenantTableTabsHTML()}

      <div class="co-tenant-table-header">
        <h3>Adjacent Tenant Category Ranking</h3>
        <p>
          Overall frequency of tenant categories directly adjacent to Trader Joe’s.
        </p>
      </div>

      <div class="adjacent-chart-card">
        <div class="adjacent-chart-title">Adjacent Tenant Category Mix</div>
        <div class="adjacent-chart-frame">
          <canvas id="adjacentCategoryPie"></canvas>
        </div>
      </div>

      <table class="co-tenant-table adjacent-tenant-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Adjacent Category</th>
            <th>Count</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;

  requestAnimationFrame(() => {
    const chartRows = getTopChartRows(
      tjAdjacentCategoryFrequency,
      "Adjacent Category",
      "Count",
      6
    );

    createPieChart(
      "adjacentCategoryPie",
      chartRows.map(row => row.label),
      chartRows.map(row => row.count),
      "Overall adjacent tenant categories"
    );
  });
}

function renderAdjacentStoreFrequencyTable() {
  const prototypeGrid = document.getElementById("prototypeGrid");
  if (!prototypeGrid) return;

  // Hide vacancy / available rows from Store Ranking display
  const filteredStoreRows = [...tjAdjacentStoreFrequency]
    .filter(row => {
      const tenant = String(row["Adjacent Tenant"] || "").trim().toLowerCase();
      const category = String(row["Adjacent Category"] || "").trim().toLowerCase();

      return tenant !== "available" &&
             tenant !== "vacant" &&
             category !== "vacancy";
    })
    .sort((a, b) => {
      const countA = Number(a["Count"]) || 0;
      const countB = Number(b["Count"]) || 0;

      if (countB !== countA) return countB - countA;

      return String(a["Adjacent Tenant"] || "")
        .localeCompare(String(b["Adjacent Tenant"] || ""));
    });

  // Re-rank after removing Available
  let currentRank = 0;
  let previousCount = null;

  const rows = filteredStoreRows
    .map((row, index) => {
      const count = Number(row["Count"]) || 0;

      if (count !== previousCount) {
        currentRank = index + 1;
        previousCount = count;
      }

      return `
        <tr>
          <td class="co-tenant-rank">${currentRank}</td>
          <td class="co-tenant-name">${row["Adjacent Tenant"] || ""}</td>
          <td>${row["Adjacent Category"] || ""}</td>
          <td class="co-tenant-count">${row["Count"] || ""}</td>
          <td class="co-tenant-count">${formatPercent(row["Share of Adjacent Tenants"])}</td>
        </tr>
      `;
    })
    .join("");

  prototypeGrid.innerHTML = `
    <div class="co-tenant-table-wrap adjacent-table-wrap">
      ${adjacentTenantTableTabsHTML()}

      <div class="co-tenant-table-header">
        <h3>Adjacent Tenant Store Ranking</h3>
        <p>
          Specific stores that appear most often directly adjacent to Trader Joe’s.
          Vacancy / available spaces are excluded from this ranking.
        </p>
      </div>

      <table class="co-tenant-table adjacent-tenant-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Adjacent Store</th>
            <th>Category</th>
            <th>Count</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdjacentImmediateCategoryTable() {
  const prototypeGrid = document.getElementById("prototypeGrid");
  if (!prototypeGrid) return;

  const rows = [...tjAdjacentImmediateCategoryFrequency]
    .sort((a, b) => (Number(a["Rank"]) || 9999) - (Number(b["Rank"]) || 9999))
    .map(row => `
      <tr>
        <td class="co-tenant-rank">${row["Rank"] || ""}</td>
        <td class="co-tenant-name">${row["Adjacent Category"] || ""}</td>
        <td class="co-tenant-count">${row["Count"] || ""}</td>
        <td class="co-tenant-count">${formatPercent(row["Share of Immediate Adjacent Tenants"])}</td>
      </tr>
    `)
    .join("");

  prototypeGrid.innerHTML = `
    <div class="co-tenant-table-wrap adjacent-table-wrap">
      ${adjacentTenantTableTabsHTML()}

      <div class="co-tenant-table-header">
        <h3>Immediate Adjacent Category Ranking</h3>
        <p>
          Category frequency using only the closest tenants on each side of Trader Joe’s:
          Adjacent_Left_1 and Adjacent_Right_1.
        </p>
      </div>

      <div class="adjacent-chart-card">
        <div class="adjacent-chart-title">Immediate Adjacent Category Mix</div>
        <div class="adjacent-chart-frame">
          <canvas id="adjacentImmediatePie"></canvas>
        </div>
      </div>

      <table class="co-tenant-table adjacent-tenant-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Adjacent Category</th>
            <th>Count</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;

  requestAnimationFrame(() => {
    const chartRows = getTopChartRows(
      tjAdjacentImmediateCategoryFrequency,
      "Adjacent Category",
      "Count",
      6
    );

    createPieChart(
      "adjacentImmediatePie",
      chartRows.map(row => row.label),
      chartRows.map(row => row.count),
      "Immediate adjacent tenant categories"
    );
  });
}

function renderAdjacentByPrototypeCategoryTable() {
  const prototypeGrid = document.getElementById("prototypeGrid");
  if (!prototypeGrid) return;

  const rows = [...tjAdjacentByPrototypeCategory]
    .sort((a, b) => {
      const p = String(a["Prototype"] || "").localeCompare(String(b["Prototype"] || ""));
      if (p !== 0) return p;
      return (Number(a["Rank Within Prototype"]) || 9999) - (Number(b["Rank Within Prototype"]) || 9999);
    })
    .map(row => `
      <tr>
        <td class="co-tenant-name">${row["Prototype"] || ""}</td>
        <td class="co-tenant-rank">${row["Rank Within Prototype"] || ""}</td>
        <td>${row["Adjacent Category"] || ""}</td>
        <td class="co-tenant-count">${row["Count"] || ""}</td>
        <td class="co-tenant-count">${formatPercent(row["Share Within Prototype"])}</td>
      </tr>
    `)
    .join("");

  prototypeGrid.innerHTML = `
    <div class="co-tenant-table-wrap adjacent-table-wrap">
      ${adjacentTenantTableTabsHTML()}

      <div class="co-tenant-table-header">
        <h3>Adjacent Category by Layout Prototype</h3>
        <p>
          Category ranking within each layout prototype.
        </p>
      </div>

      <table class="co-tenant-table adjacent-tenant-table">
        <thead>
          <tr>
            <th>Layout Prototype</th>
            <th>Rank</th>
            <th>Adjacent Category</th>
            <th>Count</th>
            <th>Share Within Layout</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function formatPercent(value) {
  if (value === undefined || value === null || value === "" || isNaN(value)) {
    return "";
  }

  return (Number(value) * 100).toFixed(1) + "%";
}


function renderAdjacentTenantTable() {
  clearAdjacentCharts();

  if (adjacentTenantTableMode === "summary") {
    renderAdjacentPrototypeSummaryTable();
    return;
  }

  if (adjacentTenantTableMode === "category") {
    renderAdjacentCategoryFrequencyTable();
    return;
  }

  if (adjacentTenantTableMode === "store") {
    renderAdjacentStoreFrequencyTable();
    return;
  }

  if (adjacentTenantTableMode === "immediate") {
    renderAdjacentImmediateCategoryTable();
    return;
  }

  if (adjacentTenantTableMode === "layoutCategory") {
    renderAdjacentByPrototypeCategoryTable();
    return;
  }

}

function clearAdjacentCharts() {
  adjacentCharts.forEach(chart => chart.destroy());
  adjacentCharts = [];
}

function createPieChart(canvasId, labels, values, titleText = "") {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return;

  const chart = new Chart(canvas, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [{
        data: values
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            boxWidth: 12,
            font: {
              size: 11
            }
          }
        },
        title: {
          display: !!titleText,
          text: titleText,
          font: {
            size: 13,
            weight: "bold"
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((sum, value) => sum + value, 0);
              const value = context.raw || 0;
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
              return `${context.label}: ${value} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  adjacentCharts.push(chart);
}

function getTopChartRows(data, labelField, countField, maxSlices = 6) {
  const cleanRows = [...data]
    .filter(row => row[labelField] && Number(row[countField]) > 0)
    .sort((a, b) => Number(b[countField]) - Number(a[countField]));

  const topRows = cleanRows.slice(0, maxSlices);
  const otherRows = cleanRows.slice(maxSlices);

  const chartRows = topRows.map(row => ({
    label: row[labelField],
    count: Number(row[countField]) || 0
  }));

  const otherCount = otherRows.reduce((sum, row) => {
    return sum + (Number(row[countField]) || 0);
  }, 0);

  if (otherCount > 0) {
    chartRows.push({
      label: "Other",
      count: otherCount
    });
  }

  return chartRows;
}

function coTenantTableTabsHTML() {
  return `
    <div class="co-tenant-tabs">
      <button
        class="${coTenantTableMode === "frequency" ? "active" : ""}"
        onclick="setCoTenantTableMode('frequency')">
        Co-Tenant Frequency
      </button>

      <button
        class="${coTenantTableMode === "category" ? "active" : ""}"
        onclick="setCoTenantTableMode('category')">
        Category Summary
      </button>
    </div>
  `;
}

function setCoTenantTableMode(mode) {
  coTenantTableMode = mode;
  renderCoTenantTable();
}

function renderCategorySummaryTable() {
  const prototypeGrid = document.getElementById("prototypeGrid");
  if (!prototypeGrid) return;

  if (!tjCategorySummary || !tjCategorySummary.length) {
    prototypeGrid.innerHTML = `
      <div class="co-tenant-table-wrap">
        ${coTenantTableTabsHTML()}
        <p>No category summary data loaded. Check WithinCenter/tj_49_category_summary.csv.</p>
      </div>
    `;
    return;
  }

  const rows = [...tjCategorySummary]
    .sort((a, b) => {
      const countA = Number(a["TJ Center Count"]) || 0;
      const countB = Number(b["TJ Center Count"]) || 0;
      return countB - countA;
    })
    .map(row => `
      <tr>
        <td class="co-tenant-name">${row["Tenant Category"] || ""}</td>
        <td class="co-tenant-count">${row["TJ Center Count"] || ""}</td>
        <td class="co-tenant-count">${row["Rows Count"] || ""}</td>
        <td class="co-tenant-count">${row["Distinct Tenant Count"] || ""}</td>
        <td>${row["Top Tenants"] || ""}</td>
        <td>${categorySummaryProjectLinksHTML(row)}</td>
      </tr>
    `)
    .join("");

  prototypeGrid.innerHTML = `
    <div class="co-tenant-table-wrap">
      ${coTenantTableTabsHTML()}

      <div class="co-tenant-table-header">
        <h3>Trader Joe’s Category Summary</h3>
        <p>
          Summary of tenant categories that appear across the Trader Joe’s center dataset.
          Click any project ID to open it in the Filter Map.
        </p>
      </div>

      <div class="adjacent-chart-card">
        <div class="adjacent-chart-title">Co-Tenant Category Mix</div>
        <div class="adjacent-chart-frame">
          <canvas id="coTenantCategoryPie"></canvas>
        </div>
      </div>

      <table class="co-tenant-table">
        <thead>
          <tr>
            <th>Tenant Category</th>
            <th>TJ Center Count</th>
            <th>Rows Count</th>
            <th>Distinct Tenant Count</th>
            <th>Top Tenants</th>
            <th>Project IDs</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;

  requestAnimationFrame(() => {
    const chartRows = getTopChartRows(
      tjCategorySummary,
      "Tenant Category",
      "Rows Count",
      20
    );

    createPieChart(
      "coTenantCategoryPie",
      chartRows.map(row => row.label),
      chartRows.map(row => row.count),
      "Co-tenant category mix by tenant records"
    );
  });
}
function categorySummaryProjectLinksHTML(row) {
  const projectIds = splitSemicolonList(row["Project IDs"]);

  if (!projectIds.length) return "";

  return projectIds.map(projectId => {
    const cleanId = String(projectId || "").trim();

    if (!cleanId) return "";

    return `
      <button class="co-tenant-project-link"
              onclick="openProjectFromPrototype('${escapeJS(cleanId)}')">
        ${cleanId}
      </button>
    `;
  }).join("");
}

function coTenantProjectLinksHTML(row) {
  const projectNames = splitSemicolonList(row["Example / Matching Centers"]);
  const projectIds = splitSemicolonList(row["Project IDs"]);

  if (!projectIds.length) return "";

  return projectIds.map((projectId, index) => {
    const cleanId = String(projectId || "").trim();
    const projectName = projectNames[index] || cleanId;

    if (!cleanId) return "";

    return `
      <button class="co-tenant-project-link"
              onclick="openProjectFromPrototype('${escapeJS(cleanId)}')">
        ${projectName}
      </button>
    `;
  }).join("");
}

function splitSemicolonList(value) {
  return String(value || "")
    .split(";")
    .map(item => item.trim())
    .filter(Boolean);
}

function getCoTenantPrimaryCategory(row) {
  return row["Primary Category"] ||
         row["Primary Categoriey"] ||
         row["PrimaryCategory"] ||
         "";
}

function getMatrixItemsByType(typeName) {
  return traderJoePrototypes
    .filter(item => {
      if (matrixMode === "layout") {
        return normalizePrototypeName(item["Prototype"]) ===
               normalizePrototypeName(typeName);
      }

      const itemType = getMatrixItemType(item);
      return normalizeMatrixValue(itemType) === normalizeMatrixValue(typeName);
    })
    .sort((a, b) => Number(a["Sort Order"]) - Number(b["Sort Order"]));
}

function getMatrixItemType(item) {
  const config = matrixModeConfig[matrixMode];

  if (matrixMode === "layout") {
    return normalizePrototypeName(item["Prototype"]);
  }

  if (matrixMode === "size") {
    return getTJSizeBucket(item["TJSize"]);
  }

  return item[config.field] || "";
}

function getTJSizeBucket(value) {
  const size = Number(value);

  if (!size || isNaN(size)) return "";

  if (size < 10000) return "Under 10k";
  if (size < 12000) return "10k–12k";
  if (size < 15000) return "12k–15k";
  if (size < 18000) return "15k–18k";

  return "18k+";
}

function normalizeMatrixValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[–—-]/g, " ")
    .replace(/\s+/g, " ");
}

function renderPrototypeTypeFilter() {
  const filter = document.getElementById("prototypeTypeFilter");
  if (!filter) return;

  const config = matrixModeConfig[matrixMode];
  const selectedTypes = selectedMatrixTypes[matrixMode];

  const panelTitle = document.getElementById("matrixCategoryPanelTitle");
  if (panelTitle) {
    panelTitle.textContent = `${config.label} Categories`;
  }

  filter.innerHTML = config.order.map(type => {
    const checked = selectedTypes.includes(type) ? "checked" : "";

    return `
      <label>
        <input
          type="checkbox"
          value="${type}"
          ${checked}
          onchange="togglePrototypeType('${type}', this.checked)"
        >
        ${type}
      </label>
    `;
  }).join("");
}

function togglePrototypeType(type, isChecked) {
  if (isChecked) {
    if (!selectedMatrixTypes[matrixMode].includes(type)) {
      selectedMatrixTypes[matrixMode].push(type);
    }
  } else {
    selectedMatrixTypes[matrixMode] = selectedMatrixTypes[matrixMode].filter(item =>
      item !== type
    );
  }

  renderPrototypeView();
}

function prototypeProjectCardHTML(item, cardIndex = 0) {
  const projectId = String(item["Project ID"] || "");

  const sitePlanPath = item["DiagramPath"] || "";
  const storefrontPath = item["StorefrontPath"] || "";

  const imagePath = matrixImageMode === "storefront"
    ? (storefrontPath || sitePlanPath)
    : (sitePlanPath || storefrontPath);

  const imageTypeLabel = matrixImageMode === "storefront"
    ? "Storefront"
    : "Site Plan";

  const projectName = item["Project Name"] || "";
  const address = item["Address"] || "";
  const cityState = item["City/State"] || "";
  const owner = item["Owner"] || "";

  const delay = Math.min(cardIndex * 35, 420);

  const highlightActive = isMatrixHighlightActive();
  const isHighlighted = cardMatchesMatrixHighlight(item);

  const highlightClass = highlightActive
    ? (isHighlighted ? "matrix-highlighted-card" : "matrix-muted-card")
    : "";

  const compactClass = matrixCardsCompact ? "matrix-card-compact" : "";

  return `
    <div class="prototype-project-card reveal-on-scroll ${highlightClass} ${compactClass}"
         style="--reveal-delay: ${delay}ms;"
         onclick="openProjectFromPrototype('${escapeJS(projectId)}')">

      ${imagePath ? `
        <img class="prototype-project-image"
             src="${imagePath}"
             alt="${escapeAttribute(projectName + " " + imageTypeLabel)}">
      ` : `
        <div class="prototype-no-image">No image</div>
      `}

      <div class="prototype-project-info">
        <h4>${projectName}</h4>

        <p class="prototype-card-address">
          ${owner ? `<strong>${owner}</strong><br>` : ""}
          ${address ? `${address}<br>` : ""}
          ${cityState || ""}
        </p>

        <div class="prototype-card-meta">
          ${prototypeMetaRow("Layout", item["Prototype"])}
          ${prototypeMetaRow("Storefront", item["Storefront"])}
          ${prototypeMetaRow("Residential", item["ResidentialRelationship"])}
          ${prototypeMetaRow("Typology", item["TypologyOfCenter"])}
          ${prototypeMetaRow("TJ Position", item["TraderJoesPosition"])}
          ${prototypeMetaRow("Parking", item["ParkingLocation"])}
          ${prototypeMetaRow("Closest Parking", formatParkingDistance(item["ClosestParkingDistanceFt"]))}
          ${prototypeMetaRow("Visibility", item["TJVisibilityToMainRoad"])}
          ${prototypeMetaRow("TJ Size", formatTJSize(item["TJSize"]))}
          ${prototypeMetaRow("Alt Anchor", item["AltAnchor"])}
        </div>
      </div>
    </div>
  `;
}

function escapeJS(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function prototypeMetaRow(label, value) {
  const cleanValue = value === undefined || value === null || value === ""
    ? "N/A"
    : value;

  return `
    <div class="prototype-meta-row">
      <span>${label}</span>
      <strong>${cleanValue}</strong>
    </div>
  `;
}

function formatParkingDistance(value) {
  if (value === undefined || value === null || value === "" || isNaN(value)) {
    return "";
  }

  return `${Number(value).toLocaleString()} ft from door`;
}

function formatTJSize(value) {
  if (value === undefined || value === null || value === "" || isNaN(value)) {
    return "";
  }

  return `${Number(value).toLocaleString()} SF`;
}

function initPrototypeScrollReveal() {
  const items = document.querySelectorAll(
    "#prototypeView .reveal-on-scroll"
  );

  if (!items.length) return;

  // Do not reset visibility after filtering.
  // This prevents cards from replaying entrance animation every time filters change.

  if (!("IntersectionObserver" in window)) {
    items.forEach(item => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      root: document.getElementById("prototypeView"),
      threshold: 0.12,
      rootMargin: "0px 0px -8% 0px"
    }
  );

  items.forEach(item => {
    observer.observe(item);
  });
}


function prototypeDiagramHTML(prototypeName) {
  const diagramPaths = {
    "Urban Context": "prototype_diagrams/urban.png",
    "Standalone": "prototype_diagrams/convenience.png",
    "Mall / Destination": "prototype_diagrams/lifestyle.png",
    "Branch": "prototype_diagrams/branch.png",
    "Spine": "prototype_diagrams/spine.png",
    "C-Shape": "prototype_diagrams/c-shape.png",
    "Cluster": "prototype_diagrams/cluster.png"
  };

  const path = diagramPaths[prototypeName];

  if (!path) return "";

  return `
    <img class="prototype-type-diagram" src="${path}" alt="${prototypeName} diagram">
  `;
}

function normalizePrototypeName(value) {
  let normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/-/g, " ");

  if (normalized === "urban") {
    return "urban context";
  }

  if (normalized === "convenience") {
    return "standalone";
  }

  if (normalized === "lifestyle") {
    return "mall / destination";
  }

  if (normalized === "mall destination" || normalized === "mall/destination") {
    return "mall / destination";
  }

  if (normalized === "c shape" || normalized === "c spine") {
    return "c shape";
  }

  return normalized;
}

function normalizeCenterTypology(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function openProjectFromPrototype(projectId) {
  showMapView();

  const project = projects.find(p =>
    String(p["Project ID"]) === String(projectId)
  );

  if (!project) {
    alert("Project not found in project_metrics_website.csv.");
    return;
  }

  showProjectDetail(project);

  const marker = markerByProjectId[String(projectId)];

  const lat = Number(project["Latitude"]);
  const lng = Number(project["Longitude"]);

  if (marker && lat && lng) {
    map.setView([lat, lng], 17);
    marker.openPopup();
  }
}






let drawMap = null;

function showDrawView() {
  document.body.classList.remove("prototype-mode");

  document.getElementById("topNav").style.display = "flex";
  document.getElementById("app").style.display = "none";
  document.getElementById("prototypeView").classList.add("hidden");
  document.getElementById("compareView").classList.add("hidden");
  document.getElementById("drawView").classList.remove("hidden");

  document.getElementById("mapViewBtn").classList.remove("active");
  document.getElementById("prototypeViewBtn").classList.remove("active");
  document.getElementById("drawViewBtn").classList.add("active");

  initializeDrawMap();

  setTimeout(() => {
    if (drawMap) {
      drawMap.invalidateSize();
    }

    if (typeof initializeDrawTools === "function") {
      initializeDrawTools();
    }
  }, 300);
}

function initializeDrawMap() {
  if (drawMap) return;

  drawMap = L.map("drawMap").setView([42.5190, -71.0325], 16);

  const drawCartoLight = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      maxZoom: 20
    }
  );

  const drawEsriSatellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri",
      maxZoom: 20
    }
  );

  drawCartoLight.addTo(drawMap);

  L.control.layers(
    {
      "Light Map": drawCartoLight,
      "Satellite": drawEsriSatellite
    },
    null,
    {
      collapsed: false
    }
  ).addTo(drawMap);

  document.getElementById("drawSummary").innerHTML =
    "<p>Draw Your Own page loaded. Next step: connect drawing and analysis tools.</p>";
}