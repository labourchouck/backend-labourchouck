import mongoose from 'mongoose';
import { Booking } from './src/models/Booking.js';
import { Wallet } from './src/models/Wallet.js';

mongoose.connect('mongodb://localhost:27017/labourchouck', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  const bookings = await Booking.find().lean();
  console.log("Bookings:", bookings.map(b => ({
    id: b._id,
    status: b.status,
    paymentMethod: b.paymentMethod,
    paymentStatus: b.paymentStatus,
    laborShare: b.laborShare,
    totalAmount: b.totalAmount
  })));
  
  const wallets = await Wallet.find().lean();
  console.log("Wallets:", wallets);
  process.exit(0);
});
