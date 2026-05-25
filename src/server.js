import 'dotenv/config'
import app from './app.js'
import { connectDb } from './config/db.js'

const port = Number(process.env.PORT) || 5000

async function main() {
  await connectDb()
  app.listen(port, () => {
    console.log(`LabourChowck API listening on :${port}`)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
