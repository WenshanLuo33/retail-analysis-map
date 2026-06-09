let projects = [];
let tenants = [];

// Map
const map = L.map("map").setView([39.5, -96.5], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap"
}).addTo(map);

// Load data
Promise.all([
  loadCSV("data/project_metrics_website.csv"),
  loadCSV("data/tenants_classified_v6.csv")
]).then(([projectData, tenantData]) => {
  projects = projectData;
  tenants = tenantData;

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

function addProjectMarkers() {
  const bounds = [];

  projects.forEach(project => {
    const lat = Number(project["Latitude"]);
    const lng = Number(project["Longitude"]);

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

    const groceryPercent = Number(project["Grocery % GLA"]) || 0;

    const marker = L.circleMarker([lat, lng], {
      radius: 7 + Math.min(groceryPercent / 8, 6),
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
    return "#f28e2b"; // orange
  }

  return "#2ca25f"; // green
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
    <p class="project-address">${project["Address"] || ""}</p>

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