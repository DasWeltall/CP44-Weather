const API_BASE_FORECAST = "https://api.open-meteo.com/v1/forecast";
const API_BASE_GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";
const API_BASE_WARNINGS = "https://api.open-meteo.com/v1/warnings";
const RAINVIEWER_META = "https://api.rainviewer.com/public/weather-maps.json";

const STORAGE_KEYS = {
  favorites: "cp44-weather-favorites",
  lastLocation: "cp44-weather-last-location"
};

const state = {
  favorites: [],
  activeLocation: null,
  forecast: null,
  warnings: [],
  radar: {
    map: null,
    baseLayer: null,
    frameLayers: [],
    frames: [],
    position: 0,
    animationTimer: null
  }
};

const dom = {};

const weatherCodeMap = new Map([
  [0, { label: "Klar", icon: "○" }],
  [1, { label: "Überwiegend klar", icon: "◐" }],
  [2, { label: "Teilweise bewölkt", icon: "◑" }],
  [3, { label: "Bewölkt", icon: "●" }],
  [45, { label: "Nebel", icon: "≋" }],
  [48, { label: "Reifnebel", icon: "≋" }],
  [51, { label: "Leichter Niesel", icon: "☂" }],
  [53, { label: "Mäßiger Niesel", icon: "☂" }],
  [55, { label: "Starker Niesel", icon: "☂" }],
  [56, { label: "Leichter Eisniesel", icon: "☂" }],
  [57, { label: "Starker Eisniesel", icon: "☂" }],
  [61, { label: "Leichter Regen", icon: "☔" }],
  [63, { label: "Regen", icon: "☔" }],
  [65, { label: "Starker Regen", icon: "☔" }],
  [66, { label: "Eisregen", icon: "☃" }],
  [67, { label: "Starker Eisregen", icon: "☃" }],
  [71, { label: "Leichter Schneefall", icon: "✼" }],
  [73, { label: "Schneefall", icon: "✼" }],
  [75, { label: "Starker Schneefall", icon: "✼" }],
  [77, { label: "Schneekörner", icon: "✵" }],
  [80, { label: "Leichte Regenschauer", icon: "☔" }],
  [81, { label: "Regenschauer", icon: "☔" }],
  [82, { label: "Starke Regenschauer", icon: "☔" }],
  [85, { label: "Leichte Schneeschauer", icon: "✼" }],
  [86, { label: "Schneeschauer", icon: "✼" }],
  [95, { label: "Gewitter", icon: "⚡" }],
  [96, { label: "Gewitter mit Hagel", icon: "⚡" }],
  [99, { label: "Schweres Gewitter", icon: "⚡" }]
]);

function initDom() {
  dom.form = document.querySelector("#location-form");
  dom.input = document.querySelector("#location-input");
  dom.searchStack = document.querySelector(".search-stack");
  dom.searchResults = document.querySelector("#search-results");
  dom.statusMessage = document.querySelector("#status-message");
  dom.clearStatus = document.querySelector("#clear-status");
  dom.favoritesList = document.querySelector("#favorites-list");
  dom.favoriteToggle = document.querySelector("#favorite-toggle");
  dom.currentContent = document.querySelector("#current-content");
  dom.airContent = document.querySelector("#air-content");
  dom.sunContent = document.querySelector("#sun-content");
  dom.forecastGrid = document.querySelector("#forecast-grid");
  dom.toggleButtons = document.querySelectorAll(".toggle-group .toggle");
  dom.warningsList = document.querySelector("#warnings-list");
  dom.warningTemplate = document.querySelector("#warning-template");
  dom.locateBtn = document.querySelector("#locate-btn");
  dom.radarMap = document.querySelector("#radar-map");
  dom.radarTimestamp = document.querySelector("#radar-timestamp");
  dom.radarBack = document.querySelector("#radar-back");
  dom.radarForward = document.querySelector("#radar-forward");
}

function loadState() {
  try {
    const savedFavorites = localStorage.getItem(STORAGE_KEYS.favorites);
    state.favorites = savedFavorites ? JSON.parse(savedFavorites) : [];
  } catch (error) {
    console.warn("Konnte Favoriten nicht laden", error);
    state.favorites = [];
  }

  try {
    const savedLocation = localStorage.getItem(STORAGE_KEYS.lastLocation);
    state.activeLocation = savedLocation ? JSON.parse(savedLocation) : null;
  } catch (error) {
    console.warn("Konnte letzte Position nicht laden", error);
    state.activeLocation = null;
  }
}

function persistFavorites() {
  try {
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(state.favorites));
  } catch (error) {
    console.warn("Konnte Favoriten nicht speichern", error);
  }
}

function persistLocation() {
  try {
    if (state.activeLocation) {
      localStorage.setItem(STORAGE_KEYS.lastLocation, JSON.stringify(state.activeLocation));
    }
  } catch (error) {
    console.warn("Konnte Standort nicht speichern", error);
  }
}

function setStatus(message, options = {}) {
  dom.statusMessage.textContent = message;
  if (options.dismissible) {
    dom.clearStatus.hidden = false;
  } else {
    dom.clearStatus.hidden = true;
  }
}

function clearResults() {
  dom.searchResults.innerHTML = "";
  dom.searchResults.hidden = true;
}

async function geocode(query) {
  const params = new URLSearchParams({
    name: query,
    count: "8",
    language: "de",
    format: "json"
  });

  const response = await fetch(`${API_BASE_GEOCODE}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Geocoding fehlgeschlagen");
  }
  return response.json();
}

async function fetchForecast({ latitude, longitude, timezone }) {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current_weather: "true",
    hourly: [
      "temperature_2m",
      "apparent_temperature",
      "relativehumidity_2m",
      "precipitation_probability",
      "precipitation",
      "weathercode",
      "windspeed_10m",
      "windgusts_10m"
    ].join(","),
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "windspeed_10m_max",
      "weathercode",
      "sunrise",
      "sunset"
    ].join(","),
    timezone: timezone || "auto"
  });

  const response = await fetch(`${API_BASE_FORECAST}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Vorhersage konnte nicht geladen werden");
  }
  return response.json();
}

async function fetchWarnings({ latitude, longitude }) {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    timezone: "auto"
  });

  const response = await fetch(`${API_BASE_WARNINGS}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Warnungen konnten nicht geladen werden");
  }
  return response.json();
}

function renderFavorites() {
  dom.favoritesList.innerHTML = "";
  if (!state.favorites.length) {
    const info = document.createElement("p");
    info.className = "placeholder";
    info.textContent = "Lege Orte über den Stern als Favorit fest.";
    dom.favoritesList.append(info);
    return;
  }

  state.favorites.forEach((location) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = `${location.name}, ${location.country}`;
    chip.addEventListener("click", () => {
      setActiveLocation(location);
    });
    dom.favoritesList.append(chip);
  });
}

function updateFavoriteToggle() {
  const isFavorite = state.activeLocation && state.favorites.some((fav) => fav.id === state.activeLocation.id);
  dom.favoriteToggle.setAttribute("aria-pressed", Boolean(isFavorite));
  dom.favoriteToggle.textContent = isFavorite ? "★" : "☆";
}

function toggleFavorite() {
  if (!state.activeLocation) return;
  const index = state.favorites.findIndex((fav) => fav.id === state.activeLocation.id);
  if (index > -1) {
    state.favorites.splice(index, 1);
  } else {
    state.favorites.push(state.activeLocation);
  }
  persistFavorites();
  renderFavorites();
  updateFavoriteToggle();
  const verb = index > -1 ? "entfernt" : "gespeichert";
  setStatus(`Favorit ${verb}.`, { dismissible: true });
}

function formatTime(isoString, options) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("de-DE", options).format(date);
}

function formatTemperature(value) {
  const numeric = Number.isFinite(value) ? value : Number(value) || 0;
  return `${Math.round(numeric)}°C`;
}

function formatWind(value) {
  const numeric = Number.isFinite(value) ? value : Number(value) || 0;
  return `${Math.round(numeric)} km/h`;
}

function formatPercentage(value) {
  const numeric = Number.isFinite(value) ? value : Number(value) || 0;
  return `${Math.round(numeric)} %`;
}

function renderCurrent() {
  const { forecast, activeLocation } = state;
  if (!forecast || !activeLocation) return;

  const { current_weather: current, hourly } = forecast;
  const hourIndex = hourly.time.findIndex((time) => time === current.time);
  const safeIndex = hourIndex > -1 ? hourIndex : 0;
  const codeInfo = weatherCodeMap.get(current.weathercode) || { label: "Unbekannt", icon: "∙" };

  const locationPieces = [activeLocation.name];
  if (activeLocation.admin1 && activeLocation.admin1 !== activeLocation.name) {
    locationPieces.push(activeLocation.admin1);
  }
  if (activeLocation.country) {
    locationPieces.push(activeLocation.country);
  }

  dom.currentContent.innerHTML = `
    <div class="fade-in">
      <p class="current-temp">${formatTemperature(current.temperature)}</p>
      <div class="current-meta">
        <span>${codeInfo.icon} ${codeInfo.label}</span>
        <span>Wind ${formatWind(current.windspeed)}</span>
        <span>Gefühlt ${formatTemperature(hourly.apparent_temperature[safeIndex])}</span>
        <span>Niederschlag ${formatPercentage(hourly.precipitation_probability[safeIndex] || 0)}</span>
        <span>Ort: ${locationPieces.join(", ")}</span>
      </div>
    </div>
  `;

  dom.airContent.innerHTML = "";
  const airGrid = document.createElement("div");
  airGrid.className = "metric-grid fade-in";
  const metrics = [
    { label: "Luftfeuchte", value: formatPercentage(hourly.relativehumidity_2m?.[safeIndex] ?? hourly.relativehumidity_2m?.[0] ?? 0) },
    { label: "Windböen", value: formatWind(hourly.windgusts_10m?.[safeIndex] ?? current.windspeed) },
    { label: "Niederschlag", value: `${(hourly.precipitation?.[safeIndex] ?? 0).toFixed(1)} mm` },
    { label: "Aktualisiert", value: formatTime(current.time, { hour: "2-digit", minute: "2-digit" }) }
  ];

  metrics.forEach((metric) => {
    const cell = document.createElement("div");
    cell.className = "metric";
    cell.innerHTML = `<span>${metric.label}</span><strong>${metric.value}</strong>`;
    airGrid.append(cell);
  });

  dom.airContent.append(airGrid);

  dom.sunContent.innerHTML = "";
  const sunGrid = document.createElement("div");
  sunGrid.className = "metric-grid fade-in";
  const { daily } = forecast;
  const sunMetrics = [
    { label: "Sonnenaufgang", value: formatTime(daily.sunrise[0], { hour: "2-digit", minute: "2-digit" }) },
    { label: "Sonnenuntergang", value: formatTime(daily.sunset[0], { hour: "2-digit", minute: "2-digit" }) },
    { label: "Tagesmaximum", value: formatTemperature(daily.temperature_2m_max[0]) },
    { label: "Tagesminimum", value: formatTemperature(daily.temperature_2m_min[0]) }
  ];

  sunMetrics.forEach((metric) => {
    const cell = document.createElement("div");
    cell.className = "metric";
    cell.innerHTML = `<span>${metric.label}</span><strong>${metric.value}</strong>`;
    sunGrid.append(cell);
  });

  dom.sunContent.append(sunGrid);
}

function renderForecast(range = "hourly") {
  const { forecast } = state;
  if (!forecast) return;
  dom.forecastGrid.innerHTML = "";

  if (range === "hourly") {
    const { hourly, current_weather } = forecast;
    if (!hourly?.time?.length) return;
    const startIndex = Math.max(0, hourly.time.findIndex((time) => time === current_weather.time));
    const endIndex = Math.min(hourly.time.length, startIndex + 24);
    for (let index = startIndex; index < endIndex; index += 1) {
      const time = hourly.time[index];
      const card = document.createElement("article");
      card.className = "forecast-card fade-in";
      const codeInfo = weatherCodeMap.get(hourly.weathercode[index]) || { label: "–", icon: "∙" };
      card.innerHTML = `
        <span>${formatTime(time, { hour: "2-digit", minute: "2-digit" })}</span>
        <strong class="forecast-temp">${formatTemperature(hourly.temperature_2m[index])}</strong>
        <span>${codeInfo.icon} ${codeInfo.label}</span>
        <span>Regen ${formatPercentage(hourly.precipitation_probability[index] || 0)}</span>
        <span>Wind ${formatWind(hourly.windspeed_10m[index])}</span>
      `;
      dom.forecastGrid.append(card);
    }
  } else {
    const { daily } = forecast;
    if (!daily?.time?.length) return;
    const daysToShow = Math.min(daily.time.length, 7);
    for (let index = 0; index < daysToShow; index += 1) {
      const time = daily.time[index];
      const card = document.createElement("article");
      card.className = "forecast-card fade-in";
      const codeInfo = weatherCodeMap.get(daily.weathercode[index]) || { label: "–", icon: "∙" };
      card.innerHTML = `
        <span>${formatTime(time, { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
        <strong class="forecast-temp">${formatTemperature(daily.temperature_2m_max[index])}</strong>
        <span>Tief ${formatTemperature(daily.temperature_2m_min[index])}</span>
        <span>${codeInfo.icon} ${codeInfo.label}</span>
        <span>Regen ${formatPercentage(daily.precipitation_probability_max[index] || 0)}</span>
        <span>Summe ${(daily.precipitation_sum[index] || 0).toFixed(1)} mm</span>
      `;
      dom.forecastGrid.append(card);
    }
  }
}

function renderWarnings() {
  dom.warningsList.innerHTML = "";
  if (!state.warnings || !state.warnings.length) {
    const p = document.createElement("p");
    p.className = "placeholder";
    p.textContent = "Keine Warnungen aktiv.";
    dom.warningsList.append(p);
    return;
  }

  state.warnings.forEach((warning) => {
    const node = dom.warningTemplate.content.cloneNode(true);
    const severity = warning.severity || warning.severity_level || warning.level || "Info";
    node.querySelector(".warning-level").textContent = `${severity}`.toUpperCase();
    node.querySelector(".warning-title").textContent = warning.event || warning.title || "Warnung";
    node.querySelector(".warning-description").textContent = warning.description || warning.instruction || "";
    const metaParts = [];
    if (warning.onset) {
      metaParts.push(`ab ${formatTime(warning.onset, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`);
    }
    if (warning.expires) {
      metaParts.push(`bis ${formatTime(warning.expires, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`);
    }
    if (warning.source) {
      metaParts.push(`Quelle: ${warning.source}`);
    }
    node.querySelector(".warning-meta").textContent = metaParts.join(" · ");
    dom.warningsList.append(node);
  });
}

async function setActiveLocation(location) {
  state.activeLocation = location;
  persistLocation();
  updateFavoriteToggle();
  setStatus(`Lade Wetterdaten für ${location.name} …`);

  try {
    const [forecast, warnings] = await Promise.all([
      fetchForecast(location),
      fetchWarnings(location)
    ]);
    state.forecast = forecast;
    state.warnings = (warnings && warnings.warnings) || [];
    renderCurrent();
    const activeTab = document.querySelector(".toggle.active");
    renderForecast(activeTab?.dataset.range || "hourly");
    renderWarnings();
    setStatus(`Daten aktualisiert für ${location.name}.`, { dismissible: true });
    updateRadar(location);
  } catch (error) {
    console.error(error);
    setStatus("Etwas ist schiefgelaufen. Bitte erneut versuchen.", { dismissible: true });
  }
}

async function handleSearch(event) {
  event.preventDefault();
  const query = dom.input.value.trim();
  if (!query) {
    setStatus("Bitte gib einen Ort ein.", { dismissible: true });
    return;
  }

  setStatus("Suche Orte …");
  try {
    const data = await geocode(query);
    if (!data.results || !data.results.length) {
      setStatus("Keine Treffer gefunden.", { dismissible: true });
      clearResults();
      return;
    }

    dom.searchResults.innerHTML = "";
    data.results.forEach((result) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result";
      button.innerHTML = `
        <span>${result.name}, ${result.admin1 || result.country}</span>
        <span>${Number(result.latitude).toFixed(2)}, ${Number(result.longitude).toFixed(2)}</span>
      `;
      button.addEventListener("click", () => {
        clearResults();
        dom.input.value = "";
        const location = {
          id: `${result.id}`,
          name: result.name,
          country: result.country,
          admin1: result.admin1,
          latitude: result.latitude,
          longitude: result.longitude,
          timezone: result.timezone
        };
        setActiveLocation(location);
      });
      dom.searchResults.append(button);
    });
    dom.searchResults.hidden = false;
    setStatus(`${data.results.length} Treffer gefunden.`, { dismissible: true });
  } catch (error) {
    console.error(error);
    setStatus("Suche fehlgeschlagen.", { dismissible: true });
  }
}

function handleToggleClick(event) {
  const button = event.currentTarget;
  dom.toggleButtons.forEach((btn) => {
    const isActive = btn === button;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive);
  });
  renderForecast(button.dataset.range);
}

function attachEvents() {
  dom.form.addEventListener("submit", handleSearch);
  dom.input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clearResults();
    }
  });
  dom.clearStatus.addEventListener("click", () => setStatus("Bereit."));
  dom.favoriteToggle.addEventListener("click", toggleFavorite);
  dom.favoriteToggle.addEventListener("keypress", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleFavorite();
    }
  });
  dom.locateBtn.addEventListener("click", useGeolocation);
  dom.toggleButtons.forEach((button) => button.addEventListener("click", handleToggleClick));
  dom.radarBack.addEventListener("click", () => stepRadar(-1));
  dom.radarForward.addEventListener("click", () => stepRadar(1));

  document.addEventListener("click", (event) => {
    if (dom.searchStack && !dom.searchStack.contains(event.target)) {
      clearResults();
    }
  });
}

function useGeolocation() {
  if (!navigator.geolocation) {
    setStatus("Geolokalisierung nicht verfügbar.", { dismissible: true });
    return;
  }

  setStatus("Hole Standort …");
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      const location = {
        id: `geo-${latitude.toFixed(2)}-${longitude.toFixed(2)}`,
        name: "Mein Standort",
        country: "",
        latitude,
        longitude,
        timezone: "auto"
      };
      await setActiveLocation(location);
    },
    (error) => {
      console.warn(error);
      setStatus("Konnte Standort nicht bestimmen.", { dismissible: true });
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function initRadar(location) {
  const { latitude, longitude } = location;
  state.radar.map = L.map(dom.radarMap, {
    zoomControl: false,
    attributionControl: false,
    scrollWheelZoom: false
  }).setView([latitude, longitude], 6);

  state.radar.baseLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "©OpenStreetMap",
    maxZoom: 12
  });
  state.radar.baseLayer.addTo(state.radar.map);
}

async function updateRadar(location) {
  if (!state.radar.map) {
    initRadar(location);
  } else {
    state.radar.map.setView([location.latitude, location.longitude], 6);
  }

  try {
    const metaResponse = await fetch(RAINVIEWER_META);
    if (!metaResponse.ok) throw new Error("Radar-Metadaten nicht verfügbar");
    const meta = await metaResponse.json();
    const frames = [...(meta.radar?.past || []), ...(meta.radar?.nowcast || [])];
    state.radar.frames = frames;
    if (!frames.length) {
      dom.radarTimestamp.textContent = "Keine Radardaten";
      return;
    }
    state.radar.position = frames.length - 1;
    prepareRadarFrames();
    renderRadarFrame();
    restartRadarAnimation();
  } catch (error) {
    console.warn(error);
    dom.radarTimestamp.textContent = "Radar nicht verfügbar";
  }
}

function prepareRadarFrames() {
  state.radar.frameLayers.forEach((layer) => {
    if (layer) state.radar.map.removeLayer(layer);
  });
  state.radar.frameLayers = state.radar.frames.map((frame) => {
    const url = `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
    return L.tileLayer(url, { opacity: 0 });
  });
}

function renderRadarFrame() {
  state.radar.frameLayers.forEach((layer, idx) => {
    if (!state.radar.map.hasLayer(layer)) {
      layer.addTo(state.radar.map);
    }
    layer.setOpacity(idx === state.radar.position ? 0.85 : 0);
  });

  const frame = state.radar.frames[state.radar.position];
  if (frame) {
    const time = new Date(frame.time * 1000);
    dom.radarTimestamp.textContent = new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit"
    }).format(time);
  }
}

function stepRadar(direction) {
  if (!state.radar.frames.length) return;
  state.radar.position = (state.radar.position + direction + state.radar.frames.length) % state.radar.frames.length;
  renderRadarFrame();
  restartRadarAnimation();
}

function restartRadarAnimation() {
  if (state.radar.animationTimer) {
    clearInterval(state.radar.animationTimer);
  }
  if (!state.radar.frames.length) return;
  state.radar.animationTimer = setInterval(() => {
    state.radar.position = (state.radar.position + 1) % state.radar.frames.length;
    renderRadarFrame();
  }, 3000);
}

function initApp() {
  initDom();
  loadState();
  renderFavorites();
  attachEvents();
  updateFavoriteToggle();

  if (state.activeLocation) {
    setActiveLocation(state.activeLocation);
  }

  registerServiceWorker();
}

document.addEventListener("DOMContentLoaded", initApp);

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("service-worker.js", { scope: "./" });
  } catch (error) {
    console.warn("Service Worker Registrierung fehlgeschlagen", error);
  }
}
