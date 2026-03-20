/**
 * Draws continent outlines from Natural Earth 110m GeoJSON data.
 * Coordinates are projected from lon/lat to canvas using equirectangular projection.
 */

export type ContinentPolygons = [number, number][][]

type Geometry =
  | { type: 'Polygon'; coordinates: [number, number][][] }
  | { type: 'MultiPolygon'; coordinates: [number, number][][][] }

type Feature = { geometry: Geometry }
type FeatureCollection = { features: Feature[] }

/** Convert GeoJSON lon/lat to normalised [0,1] coordinates */
export function lonLatToNorm(lon: number, lat: number): [number, number] {
  const x = (lon + 180) / 360
  const y = (90 - lat) / 180
  return [x, y]
}

/** Parse GeoJSON FeatureCollection into arrays of normalised polygon rings */
export function parseGeoJSON(geojson: FeatureCollection): ContinentPolygons {
  const polygons: [number, number][][] = []

  for (const feature of geojson.features) {
    const geom = feature.geometry
    if (geom.type === 'Polygon') {
      for (const ring of geom.coordinates) {
        polygons.push(ring.map(([lon, lat]) => lonLatToNorm(lon, lat)))
      }
    } else if (geom.type === 'MultiPolygon') {
      for (const polygon of geom.coordinates) {
        for (const ring of polygon) {
          polygons.push(ring.map(([lon, lat]) => lonLatToNorm(lon, lat)))
        }
      }
    }
  }

  return polygons
}

/** Raw lon/lat polygons (not normalised) for 3D projection */
export type ContinentPolygonsRaw = [number, number][][]

function parseGeoJSONRaw(geojson: FeatureCollection): ContinentPolygonsRaw {
  const polygons: [number, number][][] = []
  for (const feature of geojson.features) {
    const geom = feature.geometry
    if (geom.type === 'Polygon') {
      for (const ring of geom.coordinates) {
        polygons.push(ring.map(([lon, lat]) => [lon, lat]))
      }
    } else if (geom.type === 'MultiPolygon') {
      for (const polygon of geom.coordinates) {
        for (const ring of polygon) {
          polygons.push(ring.map(([lon, lat]) => [lon, lat]))
        }
      }
    }
  }
  return polygons
}

let cachedPolygons: ContinentPolygons | null = null
let cachedPolygonsRaw: ContinentPolygonsRaw | null = null
let loadPromise: Promise<ContinentPolygons> | null = null

/** Load and cache the GeoJSON data */
export function loadContinents(): Promise<ContinentPolygons> {
  if (cachedPolygons) return Promise.resolve(cachedPolygons)
  if (loadPromise) return loadPromise

  loadPromise = fetch('/data/ne_110m_land.geojson')
    .then((res) => res.json())
    .then((geojson: FeatureCollection) => {
      cachedPolygons = parseGeoJSON(geojson)
      cachedPolygonsRaw = parseGeoJSONRaw(geojson)
      return cachedPolygons
    })

  return loadPromise
}

/** Load and cache raw lon/lat polygon data (for 3D globe projection) */
export async function loadContinentsRaw(): Promise<ContinentPolygonsRaw> {
  if (cachedPolygonsRaw) return cachedPolygonsRaw
  await loadContinents()
  return cachedPolygonsRaw!
}

/** Get cached polygons (null if not yet loaded) */
export function getContinentPolygons(): ContinentPolygons | null {
  return cachedPolygons
}

/** Draw continent polygons onto canvas */
export function drawContinents(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  polygons?: ContinentPolygons | null,
) {
  const polys = polygons ?? cachedPolygons
  if (!polys) return

  ctx.save()
  ctx.fillStyle = 'rgba(200, 218, 245, 0.45)'
  ctx.strokeStyle = 'rgba(100, 150, 220, 0.30)'
  ctx.lineWidth = 1

  for (const ring of polys) {
    if (ring.length < 3) continue

    ctx.beginPath()
    ctx.moveTo(ring[0][0] * w, ring[0][1] * h)
    for (let i = 1; i < ring.length; i++) {
      ctx.lineTo(ring[i][0] * w, ring[i][1] * h)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  ctx.restore()
}
