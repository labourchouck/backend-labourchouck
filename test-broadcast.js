import mongoose from 'mongoose';
import 'dotenv/config';
import { User } from './src/models/User.js';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const bookingLat = 22.7446794;
  const bookingLng = 75.8782344;
  const radiusKm = 25;
  const bufferLatDiff = (radiusKm / 111) * 1.2;
  const bufferLngDiff = (radiusKm / (111 * Math.cos(bookingLat * (Math.PI / 180)))) * 1.2;
  const laborShare = 810;
  const subcategoryId = '6a5222fbfe6bc77d780cdcdb';

  const query = {
    role: { $in: ['labour', 'contractor'] },
    'labourProfile.availabilityStatus': 'available',
    'labourProfile.currentLatitude': { $gte: bookingLat - bufferLatDiff, $lte: bookingLat + bufferLatDiff },
    'labourProfile.currentLongitude': { $gte: bookingLng - bufferLngDiff, $lte: bookingLng + bufferLngDiff },
    'labourProfile.servicePricing': {
      $elemMatch: {
        subcategoryId: new mongoose.Types.ObjectId(subcategoryId),
        minPrice: { $lte: laborShare },
        maxPrice: { $gte: laborShare }
      }
    }
  };

  const potentialLaborers = await User.find(query).lean();
  console.log('Found with query:', potentialLaborers.length);
  if (potentialLaborers.length === 0) {
    const withoutPricing = await User.find({ ...query, 'labourProfile.servicePricing': undefined }).lean();
    console.log('Found without pricing filter:', withoutPricing.length);
    console.log('First without pricing:', JSON.stringify(withoutPricing[0]?.labourProfile, null, 2));
  }
  
  mongoose.disconnect();
})();
