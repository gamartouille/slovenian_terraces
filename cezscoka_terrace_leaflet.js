
// ─── CONFIG ───────────────────────────────────────────────────────────────────
const AUTOLOAD_FILES = [
    { url: '/SHPFILE/terraces.zip',        name: 'Steep and flat Parts (Bovec Terrace)',  color: '#cf1f45',   borderColor: '#ffffff', visible: true },
    { url: '/SHPFILE/points.zip',          name: 'Points for calculation (Bovec Terrace)', color: '#cf1f45', borderColor: '#ffffff', visible: false },
    { url: '/SHPFILE/polygons_prestrel_terrace_V2.zip',        name: 'Steep and flat Parts (Prestreljenik Terrace)', color: '#cf1f45', borderColor: '#ffffff', visible: true },
    { url: '/SHPFILE/slavnik_polygons.zip',        name: 'Steep and flat Parts (Slavnik Terrace)',  color: '#cf1f45',   borderColor: '#ffffff', visible: true },

];

const TOOLTIP_FIELDS = {
    'Steep and flat Parts (Bovec Terrace)': [
        { section: 'ALTITUDE (m)' },
        { key: 'ALT_MEAN',   label: 'Mean' },
        { key: 'ALT_MAX',    label: 'Max'  },
        { key: 'ALT_MIN',    label: 'Min'  },
        { section: 'SLOPE (°)' },
        { key: 'SLOPE_MEAN', label: 'Mean' },
        { key: 'SLOPE_Max',  label: 'Max'  },
        { key: 'SLOPE_MIN',  label: 'Min'  },
        { section: 'DIRECTION' },
        { key: 'DIRECTION',  label: 'Direction' },
        { section: 'CURVATURE (°)' },
        { key: 'CURVATURE',  label: 'Curvature' },
        { section: 'GEOMETRY (m)' },
        { key: 'height',     label: 'Width' },
        { key: 'width',      label: 'Length' },
    ],
    'Steep and flat Parts (Prestreljenik Terrace)': [
        { key: 'ID_POLY',    label: 'ID' },
        { section: 'ALTITUDE (m)' },
        { key: 'ALT_MEAN',   label: 'Mean' },
        { key: 'ALT_MAX',    label: 'Max'  },
        { key: 'ALT_MIN',    label: 'Min'  },
        { section: 'SLOPE (°)' }, 
        { key: 'MEAN', label: 'Mean' },
        { key: 'MAX',  label: 'Max'  },
        { key: 'MIN',  label: 'Min'  },
        { section: 'DIRECTION' },
        { key: 'DIRECTION',  label: 'Direction' }, 
        { section: 'GEOMETRY (m)' },
        { key: 'MBG_Width',     label: 'Width' },
        { key: 'MBG_Length',      label: 'Length' },
    ],
    'Steep and flat Parts (Slavnik Terrace)': [
        { key: 'ID_POLY',    label: 'ID' },
        { section: 'ALTITUDE (m)' },
        { key: 'MEAN_ALTIT',   label: 'Mean' },
        { key: 'MAX_ALTITU',    label: 'Max'  },
        { key: 'MIN_ALTITU',    label: 'Min'  },
        { section: 'SLOPE (°)' },
        { key: 'MEAN_SLOPE', label: 'Mean' },
        { key: 'MAX_SLOPE',  label: 'Max'  },
        { key: 'MIN_SLOPE',  label: 'Min'  },
    ],
};
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = ['#dd0012','#000000','#e9c46a','#f4a261','#457b9d','#ffffff','#ffb703','#8ecae6'];

// Diagnostic chargement librairies GeoTIFF
window.addEventListener('load', () => {
    console.log('[GeoTIFF debug] GeoTIFF:', typeof GeoTIFF, '| chroma:', typeof chroma);
});

// ─── Init Leaflet map ─────────────────────────────────────────────────────────
const map = L.map('map', { center: [46.85, 2.35], zoom: 5, zoomControl: false });
L.control.zoom({ position: 'bottomright' }).addTo(map);

const baseTile = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    opacity: 0.45
}).addTo(map);

// Additional base layer: topo
const topoTile = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenTopoMap',
    maxZoom: 17
});

let layers = [];

// ─── GeoPackage WASM ─────────────────────────────────────────────────────────
if (typeof GeoPackage !== 'undefined') {
    if (typeof GeoPackage.setSqljsWasmLocateFile === 'function')
        GeoPackage.setSqljsWasmLocateFile('https://cdn.jsdelivr.net/npm/@ngageoint/geopackage@4.2.3/dist/sql-wasm.wasm');
    if (typeof GeoPackage.setCanvasKitWasmLocateFile === 'function')
        GeoPackage.setCanvasKitWasmLocateFile('https://cdn.jsdelivr.net/npm/@ngageoint/geopackage@4.2.3/dist/canvaskit.wasm');
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'show' + (type ? ' ' + type : '');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.className = ''; }, 4500);
}
function setSpinner(on, msg = 'Chargement…') {
    document.getElementById('spinner').classList.toggle('active', on);
    document.getElementById('spinner-msg').textContent = msg;
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
    const lk = key.toLowerCase();
    const match = Object.keys(props).find(k => k.toLowerCase() === lk);
    return match ? props[match] : undefined;
}
function bboxOfGeoJSON(geojson) {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    function visitCoords(c) {
        if (typeof c[0] === 'number') {
            minLng = Math.min(minLng, c[0]); minLat = Math.min(minLat, c[1]);
            maxLng = Math.max(maxLng, c[0]); maxLat = Math.max(maxLat, c[1]);
        } else { c.forEach(visitCoords); }
    }
    const features = geojson.features || (geojson.type === 'Feature' ? [geojson] : []);
    features.forEach(f => f.geometry && visitCoords(f.geometry.coordinates));
    return [minLng, minLat, maxLng, maxLat];
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const tooltip = document.getElementById('tooltip');

function buildTooltipHTML(layerName, props) {
    const fields = TOOLTIP_FIELDS[layerName];
    let html = `<div class="tt-title">${layerName}</div>`;
    if (fields) {
        fields.forEach(f => {
            if (f.section) {
                html += `<div class="tt-section">${f.section}</div>`;
            } else {
                html += `<div class="tt-row"><span class="tt-key">${f.label}</span><span class="tt-val">${fmt(getFeatureProperty(props, f.key))}</span></div>`;
            }
        });
    } else {
        Object.entries(props).forEach(([k, v]) => {
            html += `<div class="tt-row"><span class="tt-key">${k}</span><span class="tt-val">${fmt(v)}</span></div>`;
        });
    }
    return html;
}

function showTooltip(e, layerName, props) {
    tooltip.innerHTML = buildTooltipHTML(layerName, props);
    tooltip.style.display = 'block';
    positionTooltip(e.originalEvent || e);
}
function hideTooltip() { tooltip.style.display = 'none'; }
function positionTooltip(ev) {
    const x = ev.clientX, y = ev.clientY;
    const w = tooltip.offsetWidth, h = tooltip.offsetHeight, m = 14;
    let left = x + m;
    if (left + w > window.innerWidth - 10) left = x - w - m;
    let top = y - h / 2;
    if (top < 10) top = 10;
    if (top + h > window.innerHeight - 10) top = window.innerHeight - h - 10;
    tooltip.style.left = left + 'px';
    tooltip.style.top  = top  + 'px';
}
document.addEventListener('mousemove', ev => {
    if (tooltip.style.display === 'block') positionTooltip(ev);
});

// ─── Coloration par pente (seuils variables par terrasse) ──────────────────────
// Retourne le seuil de pente selon la couche
function getSlopeThreshold(layerName) {
    if (layerName.includes('Bovec')) return 8;
    if (layerName.includes('Prestreljenik')) return 40;
    if (layerName.includes('Slavnik')) return 30;
    return 8; // Seuil par défaut
}

// Retourne le nom du champ contenant la pente moyenne selon la couche
function getSlopeFieldName(layerName) {
    if (layerName.includes('Bovec')) return 'SLOPE_MEAN';
    if (layerName.includes('Prestreljenik')) return 'MEAN'; // Dans section SLOPE
    if (layerName.includes('Slavnik')) return 'MEAN_SLOPE';
    return null;
}

// Retourne une couleur selon la valeur de pente et le seuil approprié pour la couche
function getColorBySlopeThreshold(slopeValue, layerName) {
    const slope = parseFloat(slopeValue);
    const threshold = getSlopeThreshold(layerName);
    if (isNaN(slope)) return '#cccccc'; // Gris si valeur invalide
    return slope >= threshold ? '#e74c3c' : '#3498db'; // Rouge si >= seuil, bleu sinon
}

// ─── Add GeoJSON layer ───────────────────────────────────────────────────────
// ─── Add GeoJSON layer (Avec Symbologie Graduée Dynamique) ───────────────────
function addGeoJSONLayer(geojson, name, color, format, visible = true, opacity = 0.55, borderColor) {
    const layerId = 'layer-' + layers.length;
    const isEmprise = name.toLowerCase().includes('extent') || name.toLowerCase().includes('emprise');
    const isSquaresLayer = name.includes('3m squares');
    const slopeFieldName = getSlopeFieldName(name); // Déterminer le champ de pente

    // Configuration initiale de la symbologie de base
    let styleNormal = {
        fillColor:   isEmprise ? 'transparent' : color,
        color:       borderColor || color,
        weight:      isEmprise ? 2.5 : 1.5,
        opacity:     1,
        fillOpacity: isEmprise ? 0 : opacity,
        interactive: !isEmprise
    };

    const styleHover = {
        weight:      isEmprise ? 4.5 : 4,
        color:       '#FFD700',
        fillOpacity: isEmprise ? 0.15 : Math.min(opacity + 0.25, 0.9),
        opacity:     1
    };

    // Création de la couche Leaflet principale
    const leafletLayer = L.geoJSON(geojson, {
        pointToLayer: (feature, latlng) => {
            const slopeColor = slopeFieldName ? getColorBySlopeThreshold(getFeatureProperty(feature.properties, slopeFieldName), name) : color;
            return L.circleMarker(latlng, {
                radius: 5,
                fillColor: slopeColor,
                color: '#fff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.9
            });
        },
        style: (feature) => {
            // Si c'est une couche de terrasse avec un champ de pente, appliquer la coloration par pente
            if (slopeFieldName && feature.properties) {
                const slopeColor = getColorBySlopeThreshold(getFeatureProperty(feature.properties, slopeFieldName), name);
                return {
                    ...styleNormal,
                    fillColor: slopeColor,
                    color: slopeColor
                };
            }
            return styleNormal;
        },
        onEachFeature: (feature, layer) => {
            if (isEmprise) return;
            const props = feature.properties || {};
            
            // Stocker la couleur initiale basée sur la pente (remplissage ET contour)
            let initialColor = slopeFieldName ? getColorBySlopeThreshold(getFeatureProperty(props, slopeFieldName), name) : (styleNormal.fillColor || color);
            layer.options.fillColor = initialColor;
            layer.options.strokeColor = initialColor; // Stocker aussi la couleur du contour
            
            layer.on({
                mouseover(e) {
                    const l = e.target;
                    if (l.setStyle) l.setStyle(styleHover);
                    if (l.bringToFront) l.bringToFront();
                    showTooltip(e, name, props);
                },
                mouseout(e) {
                    const l = e.target;
                    // Restaure la couleur basée sur la pente (remplissage ET contour)
                    if (l.setStyle) {
                        l.setStyle({
                            ...styleNormal,
                            fillColor: l.options.fillColor || color,
                            color: l.options.strokeColor || color
                        });
                    }
                    hideTooltip();
                },
                mousemove(e) { showTooltip(e, name, props); }
            });
        }
    });

    if (visible) leafletLayer.addTo(map);

    const bbox = bboxOfGeoJSON(geojson);
    if (bbox[0] !== Infinity) {
        map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [40, 40], maxZoom: 16 });
    }

    // Sauvegarde dans le registre des couches globales
    layers.push({ id: layerId, name, color: isEmprise ? borderColor || color : color, format, visible, opacity, borderColor, leafletLayer, geojson });
    updateLayersList();

    // ─── Logique Spécifique pour la couche "3m squares" ───
    // (Panneau légende intégré au panneau principal — voir HTML/CSS)
}

// Génère le menu déroulant et gère les événements de changement de champ
function setupGraduatedSymbologyMenu(layerId, geojson, leafletLayer, baseStyle) {
    // 1. Extraire les champs numériques de la première entité disponible
    const firstProps = geojson.features[0].properties;
    const numericFields = Object.keys(firstProps).filter(key => {
        const val = firstProps[key];
        return typeof val === 'number' && key !== 'OID' && key !== 'TARGET_FID' && key !== 'ORIG_FID';
    });

    // 2. Créer ou injecter le conteneur du menu dans l'interface utilisateur
    // Vérifie si le panneau de contrôle existe, sinon l'ajoute au body
    let container = document.getElementById('graduated-panel');
    if (!container) {
        container = document.createElement('div');
        container.id = 'graduated-panel';
        container.style = 'position:absolute; top:10px; right:50px; z-index:1000; background:white; padding:10px; border-radius:5px; box-shadow:0 0 15px rgba(0,0,0,0.2); font-family:sans-serif; font-size:12px;';
        document.body.appendChild(container);
    }

    // 3. Construire le HTML du sélecteur
    container.innerHTML = `
        <div style="font-weight:bold; margin-bottom:5px;">Symbologie Graduée (3m squares)</div>
        <select id="select-graduated-field" style="width:100%; padding:4px; border-radius:3px;">
            <option value="">-- Sélectionner un champ --</option>
            ${numericFields.map(f => `<option value="${f}">${f}</option>`).join('')}
        </select>
    `;

    // 4. Écouter le changement de valeur du menu déroulant
    document.getElementById('select-graduated-field').addEventListener('change', (e) => {
        const selectedField = e.target.value;
        applyGraduatedSymbology(geojson, leafletLayer, selectedField, baseStyle);
    });
}

// Applique la rampe de couleur sur la couche vectorielle
function applyGraduatedSymbology(geojson, leafletLayer, field, baseStyle) {
    if (!field) {
        // Si aucun champ n'est sélectionné, réinitialiser avec le style par défaut
        leafletLayer.eachLayer(layer => {
            layer.setStyle({ fillColor: baseStyle.fillColor, fillOpacity: baseStyle.fillOpacity });
            layer.options.fillColor = baseStyle.fillColor; // Reset mémoire interne
        });
        return;
    }

    // 1. Collecter toutes les valeurs du champ sélectionné pour calculer le Min et le Max
    const values = geojson.features
        .map(f => parseFloat(f.properties[field]))
        .filter(v => !isNaN(v));

    if (values.length === 0) return;

    const min = Math.min(...values);
    const max = Math.max(...values);

    // 2. Définir une échelle de couleurs Chroma (ex: 'YlOrRd' ou 'Viridis' selon vos préférences)
    // Rend les petites valeurs claires/jaunes et les valeurs élevées foncées/rouges
    const colorScale = chroma.scale('YlOrRd').domain([min, max]);

    // 3. Mettre à jour individuellement le style de chaque carré de la carte
    leafletLayer.eachLayer(layer => {
        const val = parseFloat(layer.feature.properties[field]);
        
        if (!isNaN(val)) {
            const calculatedColor = colorScale(val).hex();
            
            layer.setStyle({
                fillColor: calculatedColor,
                fillOpacity: 0.75 // Augmentation légère de l'opacité pour mieux apprécier le dégradé
            });
            
            // Stocker la couleur calculée dans les options pour éviter qu'elle ne disparaisse au mouseout
            layer.options.fillColor = calculatedColor;
        }
    });
}

// ─── MNT légende ─────────────────────────────────────────────────────────────
function drawMNTLegend(min, max, scale) {
    const canvas = document.getElementById('mnt-legend-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256; canvas.height = 1;
    for (let i = 0; i < 256; i++) {
        const v = min + (i / 255) * (max - min);
        ctx.fillStyle = scale(v).hex();
        ctx.fillRect(i, 0, 1, 1);
    }
    document.getElementById('mnt-min').textContent = fmt(min) + ' m';
    document.getElementById('mnt-max').textContent = fmt(max) + ' m';
    document.getElementById('mnt-legend').style.display = 'block';
}

// ─── MNT / GeoTIFF — parsing natif via geotiff.js ────────────────────────────
let tiffLayers = {}; // { [layerId]: { layer, entry } }

async function loadMNT(arrayBuffer, forcedColorscale = null, layerName = 'MNT (GeoTIFF)') {
    const colorscale = forcedColorscale || document.getElementById('mnt-colorscale').value;
    if (forcedColorscale) document.getElementById('mnt-colorscale').value = forcedColorscale;
    setSpinner(true, 'Lecture GeoTIFF…');
    try {
        if (typeof GeoTIFF === 'undefined') throw new Error('GeoTIFF.js non chargé.');

        // 1. Ouvrir le tiff
        const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();
        const width  = image.getWidth();
        const height = image.getHeight();

        // 2. Lire les données raster (bande 1 = altitude)
        const rasters = await image.readRasters({ interleave: false });
        const data = rasters[0]; // Float32Array ou Int16Array

        // 3. Bounding box + détection projection
        const bbox = image.getBoundingBox(); // [xmin, ymin, xmax, ymax]
        let [xmin, ymin, xmax, ymax] = bbox;

        // Détecter si coordonnées sont métriques (pas lat/lon)
        // Si les valeurs dépassent 180/90 c'est une projection métrique
        const isProjected = Math.abs(xmin) > 180 || Math.abs(ymin) > 90 ||
                            Math.abs(xmax) > 180 || Math.abs(ymax) > 90;

        if (isProjected) {
            setSpinner(true, 'Reprojection en WGS84…');

            // Définitions hardcodées — pas de fetch réseau
            const PROJ4_DEFS = {
                // UTM WGS84 Nord
                32628: '+proj=utm +zone=28 +datum=WGS84 +units=m +no_defs',
                32629: '+proj=utm +zone=29 +datum=WGS84 +units=m +no_defs',
                32630: '+proj=utm +zone=30 +datum=WGS84 +units=m +no_defs',
                32631: '+proj=utm +zone=31 +datum=WGS84 +units=m +no_defs',
                32632: '+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs',
                32633: '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs',
                32634: '+proj=utm +zone=34 +datum=WGS84 +units=m +no_defs',
                32635: '+proj=utm +zone=35 +datum=WGS84 +units=m +no_defs',
                // UTM ETRS89 Nord (numériquement identique à WGS84 pour notre usage)
                25828: '+proj=utm +zone=28 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
                25829: '+proj=utm +zone=29 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
                25830: '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
                25831: '+proj=utm +zone=31 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
                25832: '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
                25833: '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
                25834: '+proj=utm +zone=34 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
                25835: '+proj=utm +zone=35 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
                // Slovénie D96/TM (Bovec area!)
                3794:  '+proj=tmerc +lat_0=0 +lon_0=15 +k=0.9999 +x_0=500000 +y_0=-5000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
                3912:  '+proj=tmerc +lat_0=0 +lon_0=15 +k=0.9999 +x_0=500000 +y_0=0 +ellps=bessel +towgs84=682,-203,480,0,0,0,0 +units=m +no_defs',
                31275: '+proj=tmerc +lat_0=0 +lon_0=15 +k=0.9999 +x_0=5500000 +y_0=0 +ellps=bessel +towgs84=682,-203,480,0,0,0,0 +units=m +no_defs',
                // RGF93 / Lambert-93 (France)
                2154:  '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
                // Web Mercator
                3857:  '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs',
            };

            // Enregistrer toutes les defs d'un coup
            Object.entries(PROJ4_DEFS).forEach(([code, def]) => {
                proj4.defs('EPSG:' + code, def);
            });

            // Lire le code EPSG depuis les GeoKeys du TIFF
            let epsgCode = null;
            try {
                const geoKeys = image.geoKeyDirectory;
                if (geoKeys) {
                    epsgCode = geoKeys[3072] || geoKeys[2048] || null;
                }
            } catch(e) { console.warn('GeoKey read error:', e); }

            // Fallback : deviner la projection depuis la forme de la bbox
            if (!epsgCode) {
                const centerX = (xmin + xmax) / 2;
                const centerY = (ymin + ymax) / 2;
                const rangeX  = xmax - xmin;
                const rangeY  = ymax - ymin;

                // D96/TM (EPSG:3794, Slovénie) : x~[300000-600000], y~[0-200000]
                // car y_0=-5000000 donc Y réel = Y_géo + 5000000 → stocké petit
                if (centerX > 200000 && centerX < 700000 && centerY > 0 && centerY < 500000) {
                    epsgCode = 3794;
                    console.warn('[MNT] EPSG non détecté, fallback EPSG:3794 (D96/TM Slovénie) — bbox Y petite détectée');
                }
                // UTM standard : Y autour de 4000000-7000000 pour Europe
                else if (centerY > 3000000 && centerY < 9000000) {
                    // Deviner zone UTM depuis X (false easting 500000 par zone)
                    // UTM 32N center ~500000, 33N ~500000 (même false easting)
                    // On utilise centerX pour distinguer : 32N → X souvent 200k-800k en Europe W
                    epsgCode = (centerX < 500000) ? 32632 : 32633;
                    console.warn('[MNT] EPSG non détecté, fallback EPSG:' + epsgCode + ' (UTM)');
                }
                // Lambert-93 (France) : x~[100000-1300000], y~[6000000-7200000]
                else if (centerX > 100000 && centerX < 1300000 && centerY > 6000000 && centerY < 7200000) {
                    epsgCode = 2154;
                    console.warn('[MNT] EPSG non détecté, fallback EPSG:2154 (Lambert-93)');
                }
                else {
                    epsgCode = 32633;
                    console.warn('[MNT] EPSG non détecté, fallback EPSG:32633 par défaut');
                }
            }

            const epsgStr = 'EPSG:' + epsgCode;
            console.log('[MNT] Projection:', epsgStr, '| bbox brute:', xmin.toFixed(0), ymin.toFixed(0), xmax.toFixed(0), ymax.toFixed(0));

            if (!PROJ4_DEFS[epsgCode]) {
                throw new Error('Projection EPSG:' + epsgCode + ' non supportée. Reprojetez votre TIF en EPSG:4326 dans QGIS.');
            }

            // Reprojeter SW et NE
            const toWGS84 = proj4(epsgStr, 'WGS84');
            const sw = toWGS84.forward([xmin, ymin]);
            const ne = toWGS84.forward([xmax, ymax]);
            xmin = sw[0]; ymin = sw[1];
            xmax = ne[0]; ymax = ne[1];
            console.log('[MNT] Bbox WGS84:', xmin.toFixed(5), ymin.toFixed(5), xmax.toFixed(5), ymax.toFixed(5));
        }

        const bounds = L.latLngBounds([[ymin, xmin], [ymax, xmax]]);

        // 4. Nodata
        const fd = image.getFileDirectory();
        const nodata = fd.GDAL_NODATA ? parseFloat(fd.GDAL_NODATA) : null;

        // 5. Min / Max (ignore nodata et NaN)
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < data.length; i++) {
            const v = data[i];
            if (isNaN(v) || v === nodata || v === -9999 || v === -32768) continue;
            if (v < min) min = v;
            if (v > max) max = v;
        }
        if (!isFinite(min)) throw new Error('Aucune valeur valide dans le GeoTIFF.');

        // 6. Palette chroma
        const palettes = {
            terrain:  ['#0077b6','#90e0ef','#80b918','#386641','#a98467','#ffffff'],
            viridis:  ['#440154','#31688e','#35b779','#fde725'],
            inferno:  ['#000004','#bc3754','#f98e09','#fcffa4'],
            RdYlGn:   ['#d73027','#ffffbf','#1a9850'],
            spectral: ['#9e0142','#f46d43','#ffffbf','#66c2a5','#5e4fa2'],
            earth:    ['#000000','#4d3a29','#7a6040','#a98467','#c8b89a','#ffffff']
        };
        const pal = palettes[colorscale] || palettes.terrain;
        const scale = chroma.scale(pal).domain([min, max]);

        // 7. Rendu sur un canvas en mémoire
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(width, height);
        const px = imgData.data;

        for (let i = 0; i < data.length; i++) {
            const v = data[i];
            const idx = i * 4;
            if (isNaN(v) || v === nodata || v === -9999 || v === -32768) {
                px[idx] = px[idx+1] = px[idx+2] = 0; px[idx+3] = 0; // transparent
            } else {
                const [r,g,b] = scale(v).rgb();
                px[idx]   = r;
                px[idx+1] = g;
                px[idx+2] = b;
                px[idx+3] = 220; // légère transparence
            }
        }
        ctx.putImageData(imgData, 0, 0);

        // 8. Supprimer l'ancienne couche du même type
        const layerId = 'layer-' + layerName.toLowerCase().replace(/\s+/g, '-');
        if (tiffLayers[layerId]) {
            const old = tiffLayers[layerId];
            if (old.layer && map.hasLayer(old.layer)) map.removeLayer(old.layer);
            if (old.entry) layers = layers.filter(l => l !== old.entry);
        }

        // 9. Afficher via L.imageOverlay (canvas → dataURL)
        const url = canvas.toDataURL('image/png');
        const tiffLayer = L.imageOverlay(url, bounds, { opacity: 0.8, interactive: false });
        tiffLayer.addTo(map);
        map.fitBounds(bounds, { padding: [20, 20] });
        // Remettre les couches vecteur au-dessus du GeoTIFF
        layers.forEach(l => { if (l.leafletLayer && l.leafletLayer.bringToFront) l.leafletLayer.bringToFront(); });

        // 10. Légende
        drawMNTLegend(min, max, scale);

        // 11. Enregistrer dans la liste des couches
        const layerEntry = {
            id: layerId,
            name: layerName,
            color: '#f7a830',
            format: 'tiff',
            visible: true,
            opacity: 0.8,
            leafletLayer: tiffLayer,
            geojson: null
        };
        layers.push(layerEntry);
        tiffLayers[layerId] = { layer: tiffLayer, entry: layerEntry };
        updateLayersList();

        showToast(`✓ MNT chargé — ${width}×${height}px — alt. ${fmt(min)} → ${fmt(max)} m`, 'success');
    } catch (err) {
        console.error(err);
        showToast('✗ Erreur GeoTIFF : ' + err.message, 'error');
    } finally {
        setSpinner(false);
    }
}


// ─── Layers list UI ───────────────────────────────────────────────────────────
function updateLayersList() {
    document.getElementById('layers-list').innerHTML = [...layers].reverse().map(layer => `
        <div class="layer-item" id="item-${layer.id}">
            <div class="layer-top">
                <div class="layer-swatch" style="background:${layer.color}"></div>
                <input type="checkbox" id="chk-${layer.id}" ${layer.visible ? 'checked' : ''}
                       onchange="toggleLayer('${layer.id}', this.checked)">
                <label for="chk-${layer.id}">${layer.name}</label>
                <span class="layer-badge ${layer.format}">${layer.format.toUpperCase()}</span>
                <button class="layer-zoom-btn" title="Zoom sur la couche" onclick="zoomToLayer('${layer.id}')">⊕</button>
                <button class="layer-del-btn" title="Supprimer" onclick="removeLayer('${layer.id}')">✕</button>
            </div>
            <div class="layer-bottom">
                <span class="opacity-label">${Math.round(layer.opacity * 100)}%</span>
                <input type="range" min="0" max="1" step="0.05" value="${layer.opacity}"
                       oninput="setOpacity('${layer.id}', parseFloat(this.value), this.closest('.layer-item').querySelector('.opacity-label'))">
            </div>
        </div>
    `).join('') || '<p style="font-size:11px;color:var(--muted);font-family:var(--mono);">Aucune couche.</p>';
}

function toggleLayer(id, visible) {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    layer.visible = visible;
    if (visible) {
        if (!map.hasLayer(layer.leafletLayer)) layer.leafletLayer.addTo(map);
    } else {
        if (map.hasLayer(layer.leafletLayer)) map.removeLayer(layer.leafletLayer);
    }
}

function setOpacity(id, opacity, label) {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    layer.opacity = opacity;
    if (layer.leafletLayer.setOpacity) {
        layer.leafletLayer.setOpacity(opacity);
    } else if (layer.leafletLayer.setStyle) {
        layer.leafletLayer.setStyle({ fillOpacity: opacity, opacity: Math.min(1, opacity + 0.3) });
    }
    if (label) label.textContent = Math.round(opacity * 100) + '%';
}

function zoomToLayer(id) {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    try {
        const bounds = layer.leafletLayer.getBounds ? layer.leafletLayer.getBounds() : null;
        if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
    } catch(e) {}
}

function removeLayer(id) {
    const idx = layers.findIndex(l => l.id === id);
    if (idx === -1) return;
    const layer = layers[idx];
    if (map.hasLayer(layer.leafletLayer)) map.removeLayer(layer.leafletLayer);
    if (tiffLayers[id]) delete tiffLayers[id];
    layers.splice(idx, 1);
    updateLayersList();
}

window.toggleLayer = toggleLayer;
window.setOpacity = setOpacity;
window.zoomToLayer = zoomToLayer;
window.removeLayer = removeLayer;
window.loadFromUrl = loadFromUrl;

// ─── Format detection ─────────────────────────────────────────────────────────
function getFormat(url, forcedType) {
    if (forcedType) return forcedType;
    const clean = url.split('?')[0].toLowerCase();
    const ext = clean.split('.').pop();
    if (ext === 'gpkg') return 'gpkg';
    if (ext === 'zip')  return 'zip';
    if (ext === 'shp')  return 'shp';
    if (ext === 'tif' || ext === 'tiff') return 'tiff';
    if (clean.includes('featureserver') || clean.includes('mapserver')) return 'arcgis';
    return null;
}

// ─── Loaders ─────────────────────────────────────────────────────────────────
async function loadZip(arrayBuffer) {
    console.log(`[loadZip] Début du décompressage ZIP`);
    const zip = await JSZip.loadAsync(arrayBuffer);
    const files = Object.keys(zip.files);
    console.log(`[loadZip] Fichiers dans le ZIP:`, files);
    const gpkgFile = files.find(n => n.toLowerCase().endsWith('.gpkg'));
    if (gpkgFile) { 
        console.log(`[loadZip] Trouvé GPKG: ${gpkgFile}`);
        const inner = await zip.file(gpkgFile).async('arraybuffer'); 
        return { format: 'gpkg', data: inner }; 
    }
    const geojsonFile = files.find(n => n.toLowerCase().match(/\.(geojson|json)$/));
    if (geojsonFile) { 
        console.log(`[loadZip] Trouvé GeoJSON: ${geojsonFile}`);
        const text = await zip.file(geojsonFile).async('text'); 
        return { format: 'geojson', data: JSON.parse(text) }; 
    }
    const shpFile = files.find(n => n.toLowerCase().endsWith('.shp'));
    if (shpFile) {
        console.log(`[loadZip] Trouvé SHP: ${shpFile}, retournant le ZIP complet à shp()`);
        return { format: 'shp', data: arrayBuffer };
    }
    console.error(`[loadZip] Aucun format reconnu dans les fichiers:`, files);
    throw new Error('Aucun fichier GeoPackage, GeoJSON ou Shapefile trouvé dans le ZIP');
}

async function loadGpkg(arrayBuffer) {
    const geoPackage = await GeoPackage.GeoPackageAPI.open(new Uint8Array(arrayBuffer));
    const tables = geoPackage.getTables(true);
    const featureTables = tables.features || [];
    if (featureTables.length === 0) throw new Error('Aucune table de features trouvée dans le GeoPackage');
    const allFeatures = [];
    for (const table of featureTables)
        for (const feature of geoPackage.iterateGeoJSONFeatures(table))
            if (feature) allFeatures.push(feature);
    if (allFeatures.length === 0) throw new Error('Aucune entité GeoJSON trouvée dans le GeoPackage');
    return { type: 'FeatureCollection', features: allFeatures };
}

async function loadShp(arrayBuffer) {
    console.log(`[loadShp] Appel de shp() avec arrayBuffer de ${arrayBuffer.byteLength} bytes`);
    try {
        const result = await shp(arrayBuffer);
        console.log(`[loadShp] shp() retourné:`, result);
        if (Array.isArray(result)) {
            console.log(`[loadShp] Résultat est un Array avec ${result.length} items`);
            return { type: 'FeatureCollection', features: result.flatMap(fc => fc.features || []) };
        }
        console.log(`[loadShp] Résultat est un object:`, result.type, result.features ? result.features.length + ' features' : 'no features');
        return result;
    } catch (err) {
        console.error(`[loadShp] Erreur shp():`, err);
        throw err;
    }
}

async function loadArcGIS(url) {
    const base = url.split('?')[0].replace(/\/$/, '');
    let allFeatures = [], offset = 0, exceededTransferLimit = true;
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

// ─── Generic file loader ──────────────────────────────────────────────────────
async function processFile(arrayBuffer, name, format, color, visible, borderColor) {
    console.log(`[processFile] Début pour ${name}, format: ${format}, arrayBuffer.byteLength: ${arrayBuffer.byteLength}`);
    let geojson, layerFormat = format;
    try {
        if (format === 'arcgis') {
            console.log(`[processFile] loadArcGIS...`);
            geojson = await loadArcGIS(name); // name = url here
        } else if (format === 'zip') {
            console.log(`[processFile] loadZip...`);
            const result = await loadZip(arrayBuffer);
            console.log(`[processFile] loadZip résultat:`, result);
            layerFormat = result.format;
            if (layerFormat === 'gpkg')    geojson = await loadGpkg(result.data);
            else if (layerFormat === 'shp') geojson = await loadShp(result.data);
            else if (layerFormat === 'geojson') geojson = result.data;
            else throw new Error(`Format interne non pris en charge : ${layerFormat}`);
        } else if (format === 'gpkg') {
            console.log(`[processFile] loadGpkg...`);
            geojson = await loadGpkg(arrayBuffer);
        } else if (format === 'shp') {
            console.log(`[processFile] loadShp...`);
            geojson = await loadShp(arrayBuffer);
        } else if (format === 'geojson') {
            console.log(`[processFile] Parsing JSON...`);
            geojson = JSON.parse(new TextDecoder().decode(arrayBuffer));
        } else {
            throw new Error('Format non reconnu');
        }
        console.log(`[processFile] geojson chargé, features:`, geojson.features ? geojson.features.length : 'null');
        addGeoJSONLayer(geojson, name, color, layerFormat, visible, undefined, borderColor);
        console.log(`[processFile] ✓ addGeoJSONLayer appelée`);
        showToast(`✓ ${name} — ${geojson.features.length} entités`, 'success');
    } catch (err) {
        console.error(`[processFile] Erreur:`, err);
        throw err;
    }
}

// ─── URL loader ──────────────────────────────────────────────────────────────
async function loadFromUrl() {
    const url = document.getElementById('url-input').value.trim();
    if (!url) return;
    const format = getFormat(url);
    if (!format) { showToast('✗ Format non reconnu', 'error'); return; }
    const name = url.split('/').pop().split('.')[0];
    setSpinner(true, `Chargement : ${name}…`);
    try {
        if (format === 'arcgis') {
            const geojson = await loadArcGIS(url);
            addGeoJSONLayer(geojson, name, COLORS[layers.length % COLORS.length], 'arcgis');
            showToast(`✓ ${name} — ${geojson.features.length} entités`, 'success');
        } else if (format === 'tiff') {
            const res = await fetch(url); if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await loadMNT(await res.arrayBuffer(), null, name);
        } else {
            const res = await fetch(url); if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await processFile(await res.arrayBuffer(), name, format, COLORS[layers.length % COLORS.length], true, null);
        }
    } catch(err) {
        showToast(`✗ ${name} : ${err.message}`, 'error');
    } finally {
        setSpinner(false);
    }
}

// ─── File input handlers ──────────────────────────────────────────────────────
// Gestionnaire pour mnt-input (caché) - si l'élément existe
const mntInput = document.getElementById('mnt-input');
if (mntInput) {
    mntInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const layerName = file.name.split('.')[0];
        setSpinner(true, `Chargement GeoTIFF : ${file.name}…`);
        try {
            const ab = await file.arrayBuffer();
            await loadMNT(ab, null, layerName);
        } catch(err) {
            showToast(`✗ ${file.name} : ${err.message}`, 'error');
            setSpinner(false);
        }
        e.target.value = '';
    });
}

// ─── Zoom rapide ─────────────────────────────────────────────────────────────
function zoomToBovec() {
    // Bovec Terrace ~ Bovec, Slovénie
    map.flyTo([46.318898, 13.555], 14, { duration: 1.2 });
}
function zoomToPresteljenik() {
    // Prestreljenik Terrace ~ vallée Soča
    map.flyTo([46.3609, 13.4700], 16, { duration: 1.2 });
}
function zoomToSlavnik() {
    // Slavnik ~ Slovénie
    map.flyTo([45.4923, 14.0539], 14, { duration: 1.2 });
}

window.zoomToBovec = zoomToBovec;
window.zoomToPresteljenik = zoomToPresteljenik;
window.zoomToSlavnik = zoomToSlavnik;

// ─── Autoload ─────────────────────────────────────────────────────────────────
(async () => {
    console.log('[Autoload] Début du chargement, AUTOLOAD_FILES.length:', AUTOLOAD_FILES.length);
    if (AUTOLOAD_FILES.length === 0) {
        document.getElementById('layers-list').innerHTML =
            '<p style="font-size:11px;color:var(--muted);font-family:var(--mono);">Aucun fichier configuré.</p>';
        return;
    }
    for (let i = 0; i < AUTOLOAD_FILES.length; i++) {
        const { url, name, type: forcedType, borderColor, visible = true, palette } = AUTOLOAD_FILES[i];
        const color = AUTOLOAD_FILES[i].color || COLORS[i % COLORS.length];
        const format = getFormat(url, forcedType);
        console.log(`[Autoload] Couche ${i+1}: ${name}, format: ${format}, url: ${url}`);
        if (!format) { showToast(`✗ Format non reconnu : ${name}`, 'error'); continue; }
        setSpinner(true, `Chargement : ${name}…`);
        try {
            if (format === 'tiff') {
                console.log(`[Autoload] Chargement MNT: ${name}`);
                const res = await fetch(url); if (!res.ok) throw new Error(`HTTP ${res.status}`);
                await loadMNT(await res.arrayBuffer(), palette, name);
            } else if (format === 'arcgis') {
                console.log(`[Autoload] Chargement ArcGIS: ${name}`);
                const geojson = await loadArcGIS(url);
                addGeoJSONLayer(geojson, name, color, 'arcgis', visible, undefined, borderColor);
                showToast(`✓ ${name} — ${geojson.features.length} entités`, 'success');
            } else {
                console.log(`[Autoload] Chargement fichier ${format}: ${name}`);
                const res = await fetch(url); 
                console.log(`[Autoload] Fetch ${url}: ${res.status} ${res.statusText}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const ab = await res.arrayBuffer();
                console.log(`[Autoload] ArrayBuffer reçu: ${ab.byteLength} bytes`);
                await processFile(ab, name, format, color, visible, borderColor);
                console.log(`[Autoload] ✓ Chargé: ${name}`);
            }
        } catch(err) {
            console.error(`Erreur chargement ${name}:`, err);
            showToast(`✗ ${name} : ${err.message}`, 'error');
        }
    }
    console.log('[Autoload] Fin du chargement, layers.length:', layers.length);
    setSpinner(false);
    updateLayersList();
})();
