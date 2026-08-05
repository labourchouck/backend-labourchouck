/**
 * Utility for Indian City Coordinates, Location Resolution, and Haversine Distance Calculation.
 */

export const INDIAN_CITY_COORDINATES = {
  indore: { lat: 22.7196, lng: 75.8577 },
  bhopal: { lat: 23.2599, lng: 77.4126 },
  gwalior: { lat: 26.2183, lng: 78.1828 },
  jabalpur: { lat: 23.1815, lng: 79.9864 },
  ujjain: { lat: 23.1765, lng: 75.7885 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  pune: { lat: 18.5204, lng: 73.8567 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
  delhi: { lat: 28.6139, lng: 77.209 },
  'new delhi': { lat: 28.6139, lng: 77.209 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  surat: { lat: 21.1702, lng: 72.8311 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  kanpur: { lat: 26.4499, lng: 80.3319 },
  patna: { lat: 25.5941, lng: 85.1376 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  agra: { lat: 27.1767, lng: 78.0081 },
  varanasi: { lat: 25.3176, lng: 82.9739 },
  noida: { lat: 28.5355, lng: 77.391 },
  gurgaon: { lat: 28.4595, lng: 77.0266 },
  gurugram: { lat: 28.4595, lng: 77.0266 },
  navi_mumbai: { lat: 19.033, lng: 73.0297 },
  thane: { lat: 19.2183, lng: 72.9781 },
  nashik: { lat: 19.9975, lng: 73.7898 },
  aurangabad: { lat: 19.8762, lng: 75.3433 },
  chhatrapati_sambhajinagar: { lat: 19.8762, lng: 75.3433 },
  vadodara: { lat: 22.3072, lng: 73.1812 },
  rajkot: { lat: 22.3039, lng: 70.8022 },
  coimbatore: { lat: 11.0168, lng: 76.9558 },
  madurai: { lat: 9.9252, lng: 78.1198 },
  visakhapatnam: { lat: 17.6868, lng: 83.2185 },
  vijayawada: { lat: 16.5062, lng: 80.648 },
  kochi: { lat: 9.9312, lng: 76.2673 },
  thiruvananthapuram: { lat: 8.5241, lng: 76.9366 },
  raipur: { lat: 21.2514, lng: 81.6296 },
  ranchi: { lat: 23.3441, lng: 85.3096 },
  bhubaneswar: { lat: 20.2961, lng: 85.8245 },
  guwahati: { lat: 26.1445, lng: 91.7362 },
  dehradun: { lat: 30.3165, lng: 78.0322 },
}

/**
 * Normalizes text to lookup in city coordinates
 */
export function findCityCoordinates(text) {
  if (!text || typeof text !== 'string') return null
  const cleaned = text.toLowerCase()

  for (const [cityName, coords] of Object.entries(INDIAN_CITY_COORDINATES)) {
    const formattedCity = cityName.replace('_', ' ')
    if (cleaned.includes(formattedCity) || cleaned.includes(cityName)) {
      return coords
    }
  }
  return null
}

/**
 * Calculates straight line distance in km between two geo points (Haversine formula).
 */
export function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const numLat1 = Number(lat1)
  const numLon1 = Number(lon1)
  const numLat2 = Number(lat2)
  const numLon2 = Number(lon2)

  if (
    isNaN(numLat1) ||
    isNaN(numLon1) ||
    isNaN(numLat2) ||
    isNaN(numLon2) ||
    (numLat1 === 0 && numLon1 === 0) ||
    (numLat2 === 0 && numLon2 === 0)
  ) {
    return 0
  }

  const R = 6371 // Earth radius in KM
  const dLat = (numLat2 - numLat1) * (Math.PI / 180)
  const dLon = (numLon2 - numLon1) * (Math.PI / 180)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(numLat1 * (Math.PI / 180)) *
      Math.cos(numLat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return Number(distance.toFixed(1))
}

/**
 * Resolves best available coordinates from inputs (explicit coords, city, address, or location object)
 */
export function resolveLocationCoordinates({ lat, lng, city, state, address, locationText } = {}) {
  const parsedLat = lat != null ? Number(lat) : NaN
  const parsedLng = lng != null ? Number(lng) : NaN

  if (!isNaN(parsedLat) && !isNaN(parsedLng) && (parsedLat !== 0 || parsedLng !== 0)) {
    return { lat: parsedLat, lng: parsedLng }
  }

  // Try city or address lookup
  const fromCity = findCityCoordinates(city)
  if (fromCity) return fromCity

  const fromLocationText = findCityCoordinates(locationText)
  if (fromLocationText) return fromLocationText

  const fromAddress = findCityCoordinates(address)
  if (fromAddress) return fromAddress

  const fromState = findCityCoordinates(state)
  if (fromState) return fromState

  return null
}
