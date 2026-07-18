require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('./src/models/Booking.js').Booking;
const User = require('./src/models/User.js').User;
const Wallet = require('./src/models/Wallet.js').Wallet;
const SystemSetting = require('./src/models/SystemSetting.js').SystemSetting;
const { checkWalletEligibility } = require('./src/controllers/walletController.js');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const bookingId = '6a5b99a7458a3d14a4f249a2';
  const booking = await Booking.findById(bookingId);
  console.log('Booking subcategoryId:', booking.subcategoryId);
  console.log('Booking lat/lng:', booking.address.coordinates.coordinates);

  const radiusKm = 10;
  const bookingLng = booking.address.coordinates.coordinates[0];
  const bookingLat = booking.address.coordinates.coordinates[1];
  const latDiff = radiusKm / 111;
  const lngDiff = radiusKm / (111 * Math.cos(bookingLat * (Math.PI / 180)));
  const bufferLatDiff = latDiff * 1.2;
  const bufferLngDiff = lngDiff * 1.2;

  const potentialLaborers = await User.find({
    role: { $in: ['labour', 'contractor'] },
    'labourProfile.availabilityStatus': 'available',
    'labourProfile.currentLatitude': { $gte: bookingLat - bufferLatDiff, $lte: bookingLat + bufferLatDiff },
    'labourProfile.currentLongitude': { $gte: bookingLng - bufferLngDiff, $lte: bookingLng + bufferLngDiff },
    'labourProfile.subcategoryIds': booking.subcategoryId
  }).lean();

  console.log('potentialLaborers count:', potentialLaborers.length);
  for(let i=0; i<potentialLaborers.length; i++) {
    const l = potentialLaborers[i];
    console.log('Labor:', l._id, 'lat:', l.labourProfile.currentLatitude, 'lng:', l.labourProfile.currentLongitude);
    const wallet = await Wallet.findOne({ userId: l._id });
    console.log('Wallet for labor:', wallet ? wallet.adminBalance : 'NO WALLET');
    const isEligible = await checkWalletEligibility(l._id);
    console.log('isEligible:', isEligible);
  }

  process.exit(0);
}).catch(console.error);
