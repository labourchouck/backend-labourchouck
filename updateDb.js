import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { WorkforceRequest } from './src/models/WorkforceRequest.js'

dotenv.config()

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/labourchowk')
    const res = await WorkforceRequest.updateOne({ reference: 'CR-MSD6I2CE' }, { status: 'rejected' })
    console.log(res)
  } catch (err) {
    console.error(err)
  } finally {
    process.exit(0)
  }
}

run()
