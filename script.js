let projects = [];
let tenants = [];
let projectMarkers = [];
let markerByProjectId = {};
let highlightedMarker = null;
let traderJoePrototypes = [];

const layoutPrototypeOrder = [
  "Urban Context",
  "Standalone",
  "Mall / Destination",
  "Branch",
  "Spine",
  "C-Shape",
  "Cluster"
];

const centerTypologyOrder = [
  "Urban",
  "Inner Suburban",
  "Suburban",
  "Lifestyle",
  "Power",
  "Town Center",
  "Convenience / Neighborhood"
];

let matrixMode = "layout";

let selectedLayoutPrototypeTypes = [...layoutPrototypeOrder];
let selectedCenterTypologyTypes = [...centerTypologyOrder];


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
  loadCSV("data/trader_joes_prototypes.csv")
]).then(([projectData, tenantData, prototypeData]) => {
  projects = projectData;
  tenants = tenantData;
  traderJoePrototypes = prototypeData;

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
    "Wilder"
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

function compareSitePlanHTML(project) {
  const imagePath = project["Site Plan Image Path"];

  if (!imagePath || imagePath === 0) {
    return `
      <div class="compare-no-image">
        No site plan image available
      </div>
    `;
  }

  return `
    <img class="compare-site-plan" src="${imagePath}" alt="Site Plan">
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
  matrixMode = mode;

  const layoutBtn = document.getElementById("layoutPrototypeModeBtn");
  const typologyBtn = document.getElementById("centerTypologyModeBtn");
  const subtitle = document.getElementById("prototypeMatrixSubtitle");

  if (layoutBtn && typologyBtn) {
    layoutBtn.classList.toggle("active", matrixMode === "layout");
    typologyBtn.classList.toggle("active", matrixMode === "typology");
  }

  if (subtitle) {
    subtitle.textContent = matrixMode === "layout"
      ? "Massachusetts Trader Joe’s locations grouped by site layout pattern"
      : "Trader Joe’s locations grouped by overall retail center typology";
  }

  renderPrototypeTypeFilter();
  renderPrototypeView();
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

  renderPrototypeTypeFilter();
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

  return "";
}

function renderPrototypeView() {
  const prototypeGrid = document.getElementById("prototypeGrid");
  if (!prototypeGrid) return;

  const order = matrixMode === "layout"
    ? layoutPrototypeOrder
    : centerTypologyOrder;

  const selectedTypes = matrixMode === "layout"
    ? selectedLayoutPrototypeTypes
    : selectedCenterTypologyTypes;

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

  prototypeGrid.innerHTML = visibleTypes.map((typeName, columnIndex) => {
    const items = getMatrixItemsByType(typeName);

    const cardsHTML = items
      .map(item => prototypeProjectCardHTML(item, cardIndex++))
      .join("");

    return `
      <div class="prototype-column reveal-on-scroll"
           style="--reveal-delay: ${columnIndex * 70}ms;">
        <div class="prototype-column-header">
          <h3>${typeName}</h3>

         ${matrixMode === "layout" ? prototypeDiagramHTML(typeName) : ""}

          <p class="prototype-type-description">
          ${getMatrixTypeDescription(typeName)}
          </p>
        </div>

        <div class="prototype-card-list">
          ${cardsHTML || `<p class="prototype-empty reveal-on-scroll">No projects yet.</p>`}
        </div>
      </div>
    `;
  }).join("");

  requestAnimationFrame(() => {
    initPrototypeScrollReveal();
  });
}

function getMatrixItemsByType(typeName) {
  if (matrixMode === "layout") {
    return traderJoePrototypes
      .filter(item =>
        normalizePrototypeName(item["Prototype"]) === normalizePrototypeName(typeName)
      )
      .sort((a, b) => Number(a["Sort Order"]) - Number(b["Sort Order"]));
  }

  if (matrixMode === "typology") {
    return traderJoePrototypes
      .filter(item =>
        normalizeCenterTypology(item["TypologyOfCenter"]) ===
        normalizeCenterTypology(typeName)
      )
      .sort((a, b) => Number(a["Sort Order"]) - Number(b["Sort Order"]));
  }

  return [];
}

function renderPrototypeTypeFilter() {
  const filter = document.getElementById("prototypeTypeFilter");
  if (!filter) return;

  const order = matrixMode === "layout"
    ? layoutPrototypeOrder
    : centerTypologyOrder;

  const selectedTypes = matrixMode === "layout"
    ? selectedLayoutPrototypeTypes
    : selectedCenterTypologyTypes;

  filter.innerHTML = order.map(type => {
    const checked = selectedTypes.includes(type) ? "checked" : "";

    return `
      <label>
        <input type="checkbox"
               value="${type}"
               ${checked}
               onchange="togglePrototypeType('${type}', this.checked)">
        ${type}
      </label>
    `;
  }).join("");
}

function togglePrototypeType(type, isChecked) {
  if (matrixMode === "layout") {
    if (isChecked) {
      if (!selectedLayoutPrototypeTypes.includes(type)) {
        selectedLayoutPrototypeTypes.push(type);
      }
    } else {
      selectedLayoutPrototypeTypes = selectedLayoutPrototypeTypes.filter(item => item !== type);
    }
  }

  if (matrixMode === "typology") {
    if (isChecked) {
      if (!selectedCenterTypologyTypes.includes(type)) {
        selectedCenterTypologyTypes.push(type);
      }
    } else {
      selectedCenterTypologyTypes = selectedCenterTypologyTypes.filter(item => item !== type);
    }
  }

  renderPrototypeView();
}

function prototypeProjectCardHTML(item, cardIndex = 0) {
  const projectId = String(item["Project ID"] || "");
  const imagePath = item["DiagramPath"] || "";
  const projectName = item["Project Name"] || "";
  const address = item["Address"] || "";
  const cityState = item["City/State"] || "";
  const owner = item["Owner"] || "";

  const delay = Math.min(cardIndex * 35, 420);

  return `
    <div class="prototype-project-card reveal-on-scroll"
         style="--reveal-delay: ${delay}ms;"
         onclick="openProjectFromPrototype('${projectId}')">
      ${imagePath ? `
        <img class="prototype-project-image" src="${imagePath}" alt="${projectName}">
      ` : `
        <div class="prototype-no-image">No image</div>
      `}

      <div class="prototype-project-info">
        <h4>${projectName}</h4>
        <p>
          ${owner ? `<strong>${owner}</strong><br>` : ""}
          ${address ? `${address}<br>` : ""}
          ${cityState || ""}
        </p>
      </div>
    </div>
  `;
}

function initPrototypeScrollReveal() {
  const items = document.querySelectorAll(
    "#prototypeView .reveal-on-scroll"
  );

  if (!items.length) return;

  // Reset first, so animation replays when filtering prototype types
  items.forEach(item => {
    item.classList.remove("is-visible");
  });

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
  }, 100);
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