import 'dotenv/config';
import { getIo, emitToUser } from './src/socket.js';
import mongoose from 'mongoose';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Actually we can't trigger emitToUser from a separate script because the `io` instance is in the running server process, not this script!
  // Right! The script would just have `io = undefined`.
  // To test it, I'd need to hit an endpoint on the running server.
  
  mongoose.disconnect();
})();
