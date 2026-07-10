/**
 * Utility to calculate road distances using the Google Maps Distance Matrix API.
 * Uses a Haversine fallback if the API key is not provided or the API fails.
 */

// Haversine fallback
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Gets driving distances from an origin to multiple destinations.
 * @param {Number} originLat 
 * @param {Number} originLng 
 * @param {Array<{id: string, lat: Number, lng: Number}>} destinations 
 * @returns {Promise<Array<{id: string, distanceKm: Number, status: string}>>}
 */
export async function getRoadDistances(originLat, originLng, destinations) {
  if (!destinations || destinations.length === 0) return [];

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // Fallback if no API key is provided
  if (!apiKey) {
    console.warn('GOOGLE_MAPS_API_KEY is not set. Using Haversine formula as fallback.');
    return destinations.map(dest => ({
      id: dest.id,
      distanceKm: calculateHaversineDistance(originLat, originLng, dest.lat, dest.lng),
      status: 'OK'
    }));
  }

  const origins = `${originLat},${originLng}`;
  const destinationsParam = destinations.map(d => `${d.lat},${d.lng}`).join('|');

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinationsParam}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Maps API Error:', data.error_message || data.status);
      throw new Error(`Google Maps API returned status: ${data.status}`);
    }

    const row = data.rows[0];
    return destinations.map((dest, index) => {
      const element = row.elements[index];
      if (element.status === 'OK') {
        // element.distance.value is in meters
        return {
          id: dest.id,
          distanceKm: element.distance.value / 1000,
          status: 'OK'
        };
      }
      return {
        id: dest.id,
        distanceKm: Infinity,
        status: element.status
      };
    });
  } catch (error) {
    console.error('Failed to calculate road distances with Google Maps:', error);
    // Gracefully fallback to Haversine on network failure
    return destinations.map(dest => ({
      id: dest.id,
      distanceKm: calculateHaversineDistance(originLat, originLng, dest.lat, dest.lng),
      status: 'FALLBACK'
    }));
  }
}
