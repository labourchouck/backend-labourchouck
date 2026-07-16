import 'dotenv/config'
import http from 'http'
import app from './app.js'
import { connectDb } from './config/db.js'
import { initSocket } from './socket.js'
import { initBroadcastCron } from './cron/broadcastCron.js'

const port = Number(process.env.PORT) || 5000

async function main() {
  await connectDb()
  
  const server = http.createServer(app)
  initSocket(server)
  initBroadcastCron()

  server.listen(port, () => {
    console.log(`LabourChowck API listening on :${port}`)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
