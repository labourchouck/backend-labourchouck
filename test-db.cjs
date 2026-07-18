require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const users = await db.collection('users').find({ role: { $in: ['labour', 'contractor'] }, 'labourProfile.availabilityStatus': 'available' }).toArray();
  console.log('Potential Laborers count:', users.length);
  const wallets = await db.collection('wallets').find().toArray();
  console.log('Wallets count:', wallets.length);
  for (const w of wallets) {
    console.log(w.userId, 'adminBalance:', w.adminBalance);
  }
  const settings = await db.collection('systemsettings').findOne({configKey: 'master_config'});
  console.log('Settings walletLimit:', settings ? settings.walletLimit : null);
  process.exit(0);
}).catch(console.error);
