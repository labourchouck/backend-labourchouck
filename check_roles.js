import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/labourchowck')
  const users = await mongoose.connection.collection('users').find({}).toArray()
  console.log('Roles in DB:', [...new Set(users.map(u => u.role))])
  const activeAdmins = users.filter(u => u.role?.toLowerCase().includes('admin'))
  console.log('Admins in DB:', activeAdmins.map(u => ({ email: u.email, role: u.role })))
  process.exit(0)
}
run()
