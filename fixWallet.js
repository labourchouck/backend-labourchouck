import 'dotenv/config';
import { connectDb } from './src/config/db.js';
import { SystemSetting } from './src/models/SystemSetting.js';
import { Wallet } from './src/models/Wallet.js';

async function run() {
  await connectDb();
  
  await SystemSetting.findOneAndUpdate(
    { configKey: 'master_config' },
    { $set: { walletLimit: 10000 } },
    { upsert: true, new: true }
  );
  
  await Wallet.findOneAndUpdate(
    { userId: '6a5b6bd9906e956a2b8fac58' },
    { $set: { adminBalance: 0 } }
  );

  console.log('Fixed wallet limits and dues!');
  process.exit();
}
run().catch(console.error);
