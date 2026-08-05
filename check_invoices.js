import mongoose from 'mongoose'
mongoose.connect('mongodb://localhost:27017/labourchowk_db').then(async () => {
  const Invoice = mongoose.model('Invoice', new mongoose.Schema({}, { strict: false }));
  const invoices = await Invoice.find({ vendorId: { $exists: true } }).lean();
  console.log('Vendor Invoices:', invoices.length);
  console.log(invoices)
  process.exit(0);
})
