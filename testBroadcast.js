import 'dotenv/config';
import { connectDb } from './src/config/db.js';
import { Booking } from './src/models/Booking.js';
import { User } from './src/models/User.js';

async function run() {
  await connectDb();
  
  const bookingId = '6a5e0c494454059ed4600782'; // From my previous script output
  const booking = await Booking.findById(bookingId).lean();
  
  const radiusKm = 25; // As logged in booking.broadcastRadius
  const bookingLng = booking.address?.coordinates?.coordinates[0];
  const bookingLat = booking.address?.coordinates?.coordinates[1];
  
  const latDiff = radiusKm / 111;
  const lngDiff = radiusKm / (111 * Math.cos(bookingLat * (Math.PI / 180)));
  const bufferLatDiff = latDiff * 1.2;
  const bufferLngDiff = lngDiff * 1.2;

  const query = {
    role: { $in: ['labour', 'contractor'] },
    'labourProfile.availabilityStatus': 'available',
    'labourProfile.currentLatitude': { $gte: bookingLat - bufferLatDiff, $lte: bookingLat + bufferLatDiff },
    'labourProfile.currentLongitude': { $gte: bookingLng - bufferLngDiff, $lte: bookingLng + bufferLngDiff },
    'labourProfile.subcategoryIds': booking.subcategoryId
  };
  console.log('Query:', JSON.stringify(query, null, 2));
  
  const potentialLaborers = await User.find(query).lean();
  console.log('Potential Laborers count:', potentialLaborers.length);
  if(potentialLaborers.length > 0) {
     console.log('First Laborer:', potentialLaborers[0]._id, potentialLaborers[0].fullName);
  } else {
     // Let's see what part of the query fails
     const withoutLocation = await User.find({ ...query, 'labourProfile.currentLatitude': undefined, 'labourProfile.currentLongitude': undefined }).lean();
     console.log('Without location filter count:', withoutLocation.length);
  }
  process.exit();
}
run().catch(console.error);
