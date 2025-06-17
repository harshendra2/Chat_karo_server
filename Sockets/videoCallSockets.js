const activeCalls = {};
const userSockets = {};

const VideoSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('register', (userId) => {
      if (!userId) {
        socket.emit('call-error', { message: 'Invalid user ID' });
        return;
      }
      
      // Clean up any existing registration for this user
      const existingSocketId = userSockets[userId];
      if (existingSocketId && existingSocketId !== socket.id) {
        console.log(`User ${userId} reconnected, cleaning up old socket ${existingSocketId}`);
        // End any active calls for the old socket
        Object.keys(activeCalls).forEach(callId => {
          const call = activeCalls[callId];
          if (call.callerSocket === existingSocketId || call.receiverSocket === existingSocketId) {
            io.to(call.callerSocket).emit('call-ended', { callId });
            io.to(call.receiverSocket).emit('call-ended', { callId });
            delete activeCalls[callId];
          }
        });
      }
      
      userSockets[userId] = socket.id;
      console.log(`User ${userId} registered with socket ${socket.id}`);
    });

    socket.on('initiate-call', ({ callerId, receiverId, callId }) => {
      if (!callerId || !receiverId || !callId) {
        socket.emit('call-error', { message: 'Missing required call parameters' });
        return;
      }

      if (callerId === receiverId) {
        socket.emit('call-error', { message: 'Cannot call yourself' });
        return;
      }

      const receiverSocketId = userSockets[receiverId];
      if (!receiverSocketId) {
        socket.emit('call-error', { message: 'User not available' });
        return;
      }

      // Check if receiver is already in a call
      const existingCall = Object.values(activeCalls).find(call => 
        call.receiverId === receiverId || call.callerId === receiverId
      );
      
      if (existingCall) {
        socket.emit('call-error', { message: 'User is busy in another call' });
        return;
      }
      
      activeCalls[callId] = { 
        callerId, 
        receiverId,
        callerSocket: socket.id,
        receiverSocket: receiverSocketId,
        startTime: Date.now()
      };
      
      console.log(`Call initiated: ${callId} from ${callerId} to ${receiverId}`);
      
      io.to(receiverSocketId).emit('incoming-call', {
        callId,
        callerId
      });

      socket.emit('call-initiated', { callId });
    });

    socket.on('accept-call', ({ callId, receiverId }) => {
      if (!callId) {
        socket.emit('call-error', { message: 'Missing call ID' });
        return;
      }

      const call = activeCalls[callId];
    
      if (!call) {
        socket.emit('call-error', { message: 'Invalid call ID' });
        return;
      }

      if (call.receiverSocket !== socket.id) {
        socket.emit('call-error', { message: 'Unauthorized call acceptance' });
        return;
      }

      console.log(`Call accepted: ${callId}`);
      
      io.to(call.callerSocket).emit('call-accepted', { callId });
      io.to(call.receiverSocket).emit('call-accepted', { callId });
    });

    socket.on('reject-call', ({ callId, receiverId }) => {
      if (!callId) {
        socket.emit('call-error', { message: 'Missing call ID' });
        return;
      }

      const call = activeCalls[callId];
      if (call) {
        console.log(`Call rejected: ${callId}`);
        io.to(call.callerSocket).emit('call-rejected', { callId });
        delete activeCalls[callId];
      }
    });

    socket.on('webrtc-signal', ({ callId, signal, targetId }) => {
      if (!callId || !signal || !targetId) {
        console.error('Invalid webrtc signal parameters');
        return;
      }

      const call = activeCalls[callId];
      if (!call) {
        console.error(`Call not found for signal: ${callId}`);
        return;
      }

      const targetSocket = userSockets[targetId];
      if (!targetSocket) {
        console.error(`Target user not found: ${targetId}`);
        return;
      }

      console.log(`WebRTC signal: ${callId} -> ${targetId} (${signal.type})`);
      
      io.to(targetSocket).emit('webrtc-signal', { 
        signal, 
        callId,
        senderId: Object.keys(userSockets).find(
          key => userSockets[key] === socket.id
        )
      });
    });

    socket.on('end-call', ({ callId, targetId }) => {
      if (!callId) {
        socket.emit('call-error', { message: 'Missing call ID' });
        return;
      }

      const call = activeCalls[callId];
      if (call) {
        console.log(`Call ended: ${callId}`);
        
        // Only emit to sockets that are still connected
        if (call.callerSocket && io.sockets.sockets.has(call.callerSocket)) {
          io.to(call.callerSocket).emit('call-ended', { callId });
        }
        if (call.receiverSocket && io.sockets.sockets.has(call.receiverSocket)) {
          io.to(call.receiverSocket).emit('call-ended', { callId });
        }
        
        delete activeCalls[callId];
      }
    });

    socket.on('disconnect', () => {
      const userId = Object.keys(userSockets).find(
        key => userSockets[key] === socket.id
      );
      
      console.log(`Socket disconnected: ${socket.id} (User: ${userId})`);
      
      // End all active calls for this user
      Object.keys(activeCalls).forEach(callId => {
        const call = activeCalls[callId];
        if (call.callerSocket === socket.id || call.receiverSocket === socket.id) {
          console.log(`Ending call due to disconnect: ${callId}`);
          
          if (call.callerSocket && call.callerSocket !== socket.id && io.sockets.sockets.has(call.callerSocket)) {
            io.to(call.callerSocket).emit('call-ended', { callId });
          }
          if (call.receiverSocket && call.receiverSocket !== socket.id && io.sockets.sockets.has(call.receiverSocket)) {
            io.to(call.receiverSocket).emit('call-ended', { callId });
          }
          
          delete activeCalls[callId];
        }
      });

      if (userId) {
        console.log(`User ${userId} disconnected`);
        delete userSockets[userId];
      }
    });

    // Cleanup old calls periodically (every 5 minutes)
    setInterval(() => {
      const now = Date.now();
      const timeout = 5 * 60 * 1000; // 5 minutes
      
      Object.keys(activeCalls).forEach(callId => {
        const call = activeCalls[callId];
        if (call.startTime && (now - call.startTime) > timeout) {
          console.log(`Cleaning up old call: ${callId}`);
          
          if (call.callerSocket && io.sockets.sockets.has(call.callerSocket)) {
            io.to(call.callerSocket).emit('call-ended', { callId });
          }
          if (call.receiverSocket && io.sockets.sockets.has(call.receiverSocket)) {
            io.to(call.receiverSocket).emit('call-ended', { callId });
          }
          
          delete activeCalls[callId];
        }
      });
    }, 5 * 60 * 1000);
  });
};

module.exports = VideoSocket;