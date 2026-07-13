import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { User } from './models/User.js'

let io

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token
      if (!token) return next(new Error('Authentication error: Token missing'))

      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.sub)
      
      if (!user) return next(new Error('Authentication error: User not found'))
      
      socket.user = user
      
      // Join a room specific to this user ID so we can emit directly to them
      socket.join(user._id.toString())
      
      next()
    } catch (error) {
      next(new Error('Authentication error: Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (User: ${socket.user._id})`)

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`)
    })
  })

  return io
}

export const getIo = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized!')
  }
  return io
}

export const emitToUser = (userId, eventName, payload) => {
  if (io) {
    io.to(userId.toString()).emit(eventName, payload)
  }
}
