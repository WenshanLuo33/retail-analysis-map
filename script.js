let projects = [];
let tenants = [];
let projectMarkers = [];
let markerByProjectId = {};
let highlightedMarker = null;

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
  loadCSV("data/tenants_classified_v6.csv")
]).then(([projectData, tenantData]) => {
  projects = projectData;
  tenants = tenantData;

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

function buildOwnerFilter(projectsData) {
  const ownerFilter = document.getElementById("ownerFilter");
  if (!ownerFilter) return;

  const owners = [...new Set(
    projectsData
      .map(p => p["Owner"])
      .filter(owner => owner !== undefined && owner !== null && String(owner).trim() !== "")
      .map(owner => String(owner).trim())
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
    </div>

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

function applyFilters() {
  const selectedOwners = getSelectedOwners();
  const selectedStates = getSelectedStates();
  const tenantKeyword = document.getElementById("tenantSearch").value.toLowerCase().trim();

  const minGLA = getNumberInput("minGLA");
  const maxGLA = getNumberInput("maxGLA");

  const minGroceryPct = getNumberInput("minGroceryPct");
  const maxGroceryPct = getNumberInput("maxGroceryPct");

  const minVacancyPct = getNumberInput("minVacancyPct");
  const maxVacancyPct = getNumberInput("maxVacancyPct");

  let filteredProjects = [...projects];

  // Owner filter
  if (selectedOwners.length > 0) {
    filteredProjects = filteredProjects.filter(p =>
      selectedOwners.includes(String(p["Owner"]).trim())
    );
  } else {
    filteredProjects = [];
  }

  // State filter
  if (selectedStates.length > 0) {
   filteredProjects = filteredProjects.filter(p =>
      selectedStates.includes(getProjectState(p))
   );
  } else {
    filteredProjects = [];
  }

  // Tenant keyword filter
  if (tenantKeyword) {
    const matchedProjectIds = tenants
      .filter(t => String(t["Tenant"]).toLowerCase().includes(tenantKeyword))
      .map(t => String(t["Project ID"]));

    const uniqueIds = new Set(matchedProjectIds);

    filteredProjects = filteredProjects.filter(p =>
      uniqueIds.has(String(p["Project ID"]))
    );
  }

  // GLA filter
  if (minGLA !== null) {
    filteredProjects = filteredProjects.filter(p =>
      Number(p["Total GLA"]) >= minGLA
    );
  }

  if (maxGLA !== null) {
    filteredProjects = filteredProjects.filter(p =>
      Number(p["Total GLA"]) <= maxGLA
    );
  }

  // Grocery percentage filter
  if (minGroceryPct !== null) {
    filteredProjects = filteredProjects.filter(p =>
      Number(p["Grocery % GLA"]) >= minGroceryPct
    );
  }

  if (maxGroceryPct !== null) {
    filteredProjects = filteredProjects.filter(p =>
      Number(p["Grocery % GLA"]) <= maxGroceryPct
    );
  }

  // Vacancy percentage filter
  if (minVacancyPct !== null) {
    filteredProjects = filteredProjects.filter(p =>
      Number(p["Vacancy %"]) >= minVacancyPct
    );
  }

  if (maxVacancyPct !== null) {
    filteredProjects = filteredProjects.filter(p =>
      Number(p["Vacancy %"]) <= maxVacancyPct
    );
  }

  addProjectMarkers(filteredProjects);

  const projectListHTML = filteredProjects.map(project => {
    const smallTenantCount =
      (Number(project["Tenant Count 0-3k"]) || 0) +
      (Number(project["Tenant Count 3k-10k"]) || 0);

    return `
      <div class="filter-project-card"
           onclick="showProjectDetailFromId('${project["Project ID"]}')"
           onmouseenter="highlightProjectMarker('${project["Project ID"]}')"
           onmouseleave="resetProjectMarker('${project["Project ID"]}')">
        <h3>${project["Project Name"]}</h3>
        <p>${project["Owner"] || ""}${project["City/State"] ? " · " + project["City/State"] : ""}</p>

        <div class="filter-metrics">
          <div><strong>GLA:</strong> ${formatNumber(project["Total GLA"])} SF</div>
          <div><strong>Grocery:</strong> ${project["Grocery Tenant"] || "N/A"}</div>
          <div><strong>Grocery SF:</strong> ${formatNumber(project["Grocery SF"])} SF</div>
          <div><strong>Grocery %:</strong> ${round(project["Grocery % GLA"], 1)}%</div>
          <div><strong>Tenants &lt;10k SF:</strong> ${smallTenantCount}</div>
          <div><strong>Vacancy SF:</strong> ${formatNumber(project["Vacancy"])}</div>
          <div><strong>Vacancy %:</strong> ${round(project["Vacancy %"], 1)}%</div>
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("project-detail").innerHTML = `
    <h2>Filter Result</h2>
    <p><strong>${filteredProjects.length}</strong> projects found.</p>

    <div class="filter-note">
      ${selectedOwners.length ? `Owner: <strong>${selectedOwners.join(", ")}</strong><br>` : "Owner: <strong>None selected</strong><br>"}
      ${selectedStates.length ? `State: <strong>${selectedStates.join(", ")}</strong><br>` : "State: <strong>None selected</strong><br>"}
      ${tenantKeyword ? `Tenant contains: <strong>${tenantKeyword}</strong><br>` : ""}
      ${minGLA !== null ? `Min GLA: <strong>${formatNumber(minGLA)}</strong><br>` : ""}
      ${maxGLA !== null ? `Max GLA: <strong>${formatNumber(maxGLA)}</strong><br>` : ""}
      ${minGroceryPct !== null ? `Min Grocery %: <strong>${minGroceryPct}%</strong><br>` : ""}
      ${maxGroceryPct !== null ? `Max Grocery %: <strong>${maxGroceryPct}%</strong><br>` : ""}
      ${minVacancyPct !== null ? `Min Vacancy %: <strong>${minVacancyPct}%</strong><br>` : ""}
      ${maxVacancyPct !== null ? `Max Vacancy %: <strong>${maxVacancyPct}%</strong>` : ""}
    </div>

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