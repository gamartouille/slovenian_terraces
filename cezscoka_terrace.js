// ─── CONFIG ───────────────────────────────────────────────────────────────────
const AUTOLOAD_FILES = [
    { url: '/GPKG/EMPRISE_TERRACE2.zip', name: 'Extent Terrace', color: '#e6aa8ec4', borderColor: '#eb3700' },
    { url: '/SHPFILE/terraces.zip', name: 'Steep and flat Parts', color: '#e6dd8e', borderColor: '#219ebc' },
    // { url: 'https://services.arcgis.com/.../FeatureServer/0', name: 'Couche ArcGIS' },
];

// Champs à afficher dans le tooltip, par couche.
// La clé doit correspondre exactement au nom de la couche (name: ci-dessus).
// Si une couche n'est pas listée ici, tous ses champs s'affichent.
const TOOLTIP_FIELDS = {
    'Steep and flat Parts': [
        { section: 'ALTITUDE (m)' },
        { key: 'ALT_MEAN',   label: 'Mean'     },
        { key: 'ALT_MAX',    label: 'Max'         },
        { key: 'ALT_MIN',    label: 'Min'         },
        { section: 'SLOPE (°)' },
        { key: 'SLOPE_MEAN', label: 'Mean'     },
        { key: 'SLOPE_Max',  label: 'Max'         },
        { key: 'SLOPE_MIN',  label: 'Min'         },
        { section: 'DIRECTION' },
        { key: 'DIRECTION', label: 'Direction'   },
        { section: "CURVATURE (°)" },
        { key: "CURVATURE", label: "Curvature"   },
        { section: "GEOMETRY (m)" },
        { key: "height", label: "Height" },
        { key: "width", label: "Width" },
    ],
};
// ─────────────────────────────────────────────────────────────────────────────

const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/bright',
    center: [2.35, 46.85],
    zoom: 5
});
map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

let layers = [];
const COLORS = ['#dd0012','#000000','#e9c46a','#f4a261','#457b9d','#ffffff','#ffb703','#8ecae6'];

if (typeof GeoPackage !== 'undefined') {
    if (typeof GeoPackage.setSqljsWasmLocateFile === 'function') {
        GeoPackage.setSqljsWasmLocateFile('https://cdn.jsdelivr.net/npm/@ngageoint/geopackage@4.2.3/dist/sql-wasm.wasm');
    }
    if (typeof GeoPackage.setCanvasKitWasmLocateFile === 'function') {
        GeoPackage.setCanvasKitWasmLocateFile('https://cdn.jsdelivr.net/npm/@ngageoint/geopackage@4.2.3/dist/canvaskit.wasm');
    }
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'show' + (isError ? ' error' : '');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.className = ''; }, 4000);
}
function setSpinner(on, msg = 'Chargement…') {
    document.getElementById('spinner').classList.toggle('active', on);
    document.getElementById('spinner-msg').textContent = msg;
}
function bboxOfGeoJSON(geojson) {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    function visitCoords(coords) {
        if (typeof coords[0] === 'number') {
            minLng = Math.min(minLng, coords[0]); minLat = Math.min(minLat, coords[1]);
            maxLng = Math.max(maxLng, coords[0]); maxLat = Math.max(maxLat, coords[1]);
        } else { coords.forEach(visitCoords); }
    }
    const features = geojson.features || (geojson.type === 'Feature' ? [geojson] : []);
    features.forEach(f => f.geometry && visitCoords(f.geometry.coordinates));
    return [minLng, minLat, maxLng, maxLat];
}
function fmt(val) {
    if (val === null || val === undefined || val === '' || val === 'NULL') return '—';
    const n = parseFloat(val);
    if (!isNaN(n)) return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    return val;
}

function getFeatureProperty(props, key) {
    if (!props || !key) return undefined;
    if (key in props) return props[key];
    const lowerKey = key.toLowerCase();
    const match = Object.keys(props).find(k => k.toLowerCase() === lowerKey);
    return match ? props[match] : undefined;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const tooltip = document.getElementById('tooltip');

function showTooltip(e, layerName, props) {
    const fields = TOOLTIP_FIELDS[layerName];
    let html = `<div class="tt-title">${layerName}</div>`;

    if (fields) {
        fields.forEach(f => {
            if (f.section) {
                html += `<div class="tt-section">${f.section}</div>`;
            } else {
                html += `<div class="tt-row">
                    <span class="tt-key">${f.label}</span>
                    <span class="tt-val">${fmt(getFeatureProperty(props, f.key))}</span>
                </div>`;
            }
        });
    } else {
        // fallback : tous les champs
        Object.entries(props).forEach(([k, v]) => {
            html += `<div class="tt-row">
                <span class="tt-key">${k}</span>
                <span class="tt-val">${fmt(v)}</span>
            </div>`;
        });
    }

    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    moveTooltip(e);
}

function moveTooltip(e) {
    const x = e.originalEvent.clientX;
    const y = e.originalEvent.clientY;
    const w = tooltip.offsetWidth;
    const h = tooltip.offsetHeight;
    const margin = 14;
    // Colle à droite du curseur, bascule à gauche si débordement
    let left = x + margin;
    if (left + w > window.innerWidth - 10) left = x - w - margin;
    let top = y - h / 2;
    if (top < 10) top = 10;
    if (top + h > window.innerHeight - 10) top = window.innerHeight - h - 10;
    tooltip.style.left = left + 'px';
    tooltip.style.top  = top  + 'px';
}

function hideTooltip() {
    tooltip.style.display = 'none';
}

// ─── Couche de highlight ──────────────────────────────────────────────────────
// Une source/couche dédiée pour le polygone survolé
function ensureHighlightLayer() {
    if (map.getSource('highlight-source')) return;
    map.addSource('highlight-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });
    map.addLayer({
        id: 'highlight-fill',
        type: 'fill',
        source: 'highlight-source',
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.18 }
    });
    map.addLayer({
        id: 'highlight-line',
        type: 'line',
        source: 'highlight-source',
        paint: { 'line-color': '#ffffff', 'line-width': 2.5, 'line-opacity': 0.9 }
    });
}

function setHighlight(feature) {
    if (!map.getSource('highlight-source')) return;
    map.getSource('highlight-source').setData(
        feature
            ? { type: 'FeatureCollection', features: [feature] }
            : { type: 'FeatureCollection', features: [] }
    );
}

// ─── Ajout d'une couche + interactivité ───────────────────────────────────────
function addGeoJSONLayer(geojson, name, color, format, visible = true, opacity = 0.55, borderColor) {
    const id = 'layer-' + layers.length;
    layers.push({ id, name, color, format, visible, opacity, borderColor });

    const isEmprise = name === 'Emprise Terrace';
    const fillColor = isEmprise ? (borderColor || '#eb3700') : color;
    const lineColor = isEmprise ? (borderColor || '#eb3700') : color;
    const lineWidth = isEmprise ? 2.5 : 1.5;
    const fillOpacity = isEmprise ? 0.1 : opacity;

    map.addSource(id, { type: 'geojson', data: geojson });
    map.addLayer({ id: id + '-fill', type: 'fill', source: id,
        filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
        paint: {
            'fill-color': fillColor,
            'fill-opacity': isEmprise ? fillOpacity : ['case', ['==', ['geometry-type'], 'MultiPolygon'], 0, fillOpacity]
        } });
    map.addLayer({ id: id + '-line', type: 'line', source: id,
        paint: {
            'line-color': isEmprise ? lineColor : ['case', ['==', ['geometry-type'], 'MultiPolygon'], '#000', lineColor],
            'line-width': isEmprise ? lineWidth : ['case', ['==', ['geometry-type'], 'MultiPolygon'], 1.2, lineWidth]
        } });
    map.addLayer({ id: id + '-circle', type: 'circle', source: id,
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-color': color, 'circle-radius': 5,
                 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' } });

    // Highlight layer au-dessus de tout
    ensureHighlightLayer();
    if (map.getLayer('highlight-fill')) map.moveLayer('highlight-fill');
    if (map.getLayer('highlight-line')) map.moveLayer('highlight-line');

    // Hover sur polygones
    map.on('mousemove', id + '-fill', (e) => {
        map.getCanvas().style.cursor = 'crosshair';
        const feature = e.features[0];
        setHighlight(feature);
        showTooltip(e, name, feature.properties);
    });
    map.on('mousemove', id + '-fill', moveTooltip);

    map.on('mouseleave', id + '-fill', () => {
        map.getCanvas().style.cursor = '';
        setHighlight(null);
        hideTooltip();
    });

    // Hover sur points
    map.on('mousemove', id + '-circle', (e) => {
        map.getCanvas().style.cursor = 'crosshair';
        showTooltip(e, name, e.features[0].properties);
    });
    map.on('mouseleave', id + '-circle', () => {
        map.getCanvas().style.cursor = '';
        hideTooltip();
    });

    const bbox = bboxOfGeoJSON(geojson);
    if (bbox[0] !== Infinity) {
        map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, maxZoom: 16 });
    }
    updateLayersList();
}

function updateLayersList() {
    document.getElementById('layers-list').innerHTML = layers.map(layer => `
        <div class="layer-item">
            <div class="layer-top">
                <div class="layer-swatch" style="background:${layer.color}"></div>
                <input type="checkbox" id="chk-${layer.id}" ${layer.visible ? 'checked' : ''}
                       onchange="toggleLayer('${layer.id}', this.checked)">
                <label for="chk-${layer.id}">${layer.name}</label>
                <span class="layer-badge ${layer.format}">${layer.format.toUpperCase()}</span>
            </div>
            <div class="layer-bottom">
                <span class="opacity-label">${Math.round(layer.opacity * 100)}%</span>
                <input type="range" min="0" max="1" step="0.05" value="${layer.opacity}"
                       oninput="setOpacity('${layer.id}', this.value, this.closest('.layer-item').querySelector('.opacity-label'))">
            </div>
        </div>
    `).join('');
}

function toggleLayer(id, visible) {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    layer.visible = visible;
    ['fill','line','circle'].forEach(t =>
        map.setLayoutProperty(id + '-' + t, 'visibility', visible ? 'visible' : 'none'));
}

function setOpacity(id, opacity, label) {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    layer.opacity = parseFloat(opacity);
    map.setPaintProperty(id + '-fill',   'fill-opacity',   parseFloat(opacity));
    map.setPaintProperty(id + '-line',   'line-opacity',   parseFloat(opacity));
    map.setPaintProperty(id + '-circle', 'circle-opacity', parseFloat(opacity));
    if (label) label.textContent = Math.round(opacity * 100) + '%';
}

window.setOpacity = setOpacity;
window.toggleLayer = toggleLayer;

// ─── Détection du format ──────────────────────────────────────────────────────
function getFormat(url, forcedType) {
    if (forcedType) return forcedType;
    const clean = url.split('?')[0].toLowerCase();
    const ext = clean.split('.').pop();
    if (ext === 'gpkg') return 'gpkg';
    if (ext === 'zip') return 'zip';
    if (ext === 'shp') return 'shp';
    if (clean.includes('featureserver') || clean.includes('mapserver')) return 'arcgis';
    return null;
}

// ─── Loaders ─────────────────────────────────────────────────────────────────
async function loadZip(arrayBuffer) {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const files = Object.keys(zip.files);
    const gpkgFile = files.find(name => name.toLowerCase().endsWith('.gpkg'));
    if (gpkgFile) {
        const inner = await zip.file(gpkgFile).async('arraybuffer');
        return { format: 'gpkg', data: inner };
    }
    const geojsonFile = files.find(name => name.toLowerCase().match(/\.(geojson|json)$/));
    if (geojsonFile) {
        const text = await zip.file(geojsonFile).async('text');
        return { format: 'geojson', data: JSON.parse(text) };
    }
    const shpFile = files.find(name => name.toLowerCase().endsWith('.shp'));
    if (shpFile) {
        return { format: 'shp', data: arrayBuffer };
    }
    throw new Error('Aucun fichier GeoPackage, GeoJSON ou Shapefile trouvé dans le ZIP');
}

async function loadGpkg(arrayBuffer) {
    const geoPackage = await GeoPackage.GeoPackageAPI.open(new Uint8Array(arrayBuffer));
    const tables = geoPackage.getTables(true);
    const featureTables = tables.features || [];
    const tileTables = tables.tiles || [];

    if (featureTables.length === 0) {
        if (tileTables.length > 0) {
            throw new Error(`GeoPackage supporte uniquement les données vecteur. Ce GeoPackage contient des tables raster : ${tileTables.join(', ')}`);
        }
        throw new Error('Aucune table de features trouvée dans le GeoPackage');
    }

    const allFeatures = [];
    for (const table of featureTables) {
        for (const feature of geoPackage.iterateGeoJSONFeatures(table)) {
            if (feature) allFeatures.push(feature);
        }
    }

    if (allFeatures.length === 0) {
        throw new Error('Aucune entité GeoJSON trouvée dans le GeoPackage');
    }
    return { type: 'FeatureCollection', features: allFeatures };
}

async function loadShp(arrayBuffer) {
    const result = await shp(arrayBuffer);
    if (Array.isArray(result))
        return { type: 'FeatureCollection', features: result.flatMap(fc => fc.features || []) };
    return result;
}

async function loadArcGIS(url) {
    const base = url.split('?')[0].replace(/\/$/, '');
    let allFeatures = [], offset = 0;
    let exceededTransferLimit = true;
    while (exceededTransferLimit) {
        const queryUrl = `${base}/query?f=geojson&where=1%3D1&outFields=*&resultOffset=${offset}&resultRecordCount=1000`;
        const res = await fetch(queryUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || 'Erreur ArcGIS');
        const features = data.features || [];
        allFeatures = allFeatures.concat(features);
        offset += features.length;
        exceededTransferLimit = data.exceededTransferLimit === true && features.length > 0;
    }
    return { type: 'FeatureCollection', features: allFeatures };
}

// ─── Chargement automatique ───────────────────────────────────────────────────
map.on('load', async () => {
    if (AUTOLOAD_FILES.length === 0) {
        document.getElementById('layers-list').innerHTML =
            '<p style="font-family:\'DM Mono\',monospace;font-size:11px;color:#555;">Aucun fichier configuré.</p>';
        return;
    }
    setSpinner(true);
    for (let i = 0; i < AUTOLOAD_FILES.length; i++) {
        const { url, name, type: forcedType, borderColor } = AUTOLOAD_FILES[i];
        const color = COLORS[i % COLORS.length];
        const format = getFormat(url, forcedType);
        if (!format) { showToast(`✗ Format non reconnu : ${name}`, true); continue; }
        try {
            setSpinner(true, `Chargement : ${name}…`);
            let geojson;
            let layerFormat = format;
            if (format === 'arcgis') {
                geojson = await loadArcGIS(url);
            } else {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                if (format === 'zip') {
                    const result = await loadZip(arrayBuffer);
                    layerFormat = result.format;
                    if (layerFormat === 'gpkg') {
                        geojson = await loadGpkg(result.data);
                    } else if (layerFormat === 'shp') {
                        geojson = await loadShp(result.data);
                    } else if (layerFormat === 'geojson') {
                        geojson = result.data;
                    } else {
                        throw new Error(`Format interne non pris en charge : ${layerFormat}`);
                    }
                } else if (format === 'gpkg') {
                    geojson = await loadGpkg(arrayBuffer);
                } else {
                    geojson = await loadShp(arrayBuffer);
                }
            }
            addGeoJSONLayer(geojson, name, color, layerFormat, true, undefined, borderColor);
            showToast(`✓ ${name} — ${geojson.features.length} entités`);
        } catch (err) {
            console.error(`Erreur chargement ${name}:`, err);
            showToast(`✗ ${name} : ${err.message}`, true);
        }
    }
    setSpinner(false);
});