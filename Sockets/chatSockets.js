const { 
  getAllUser, 
  OffLine, 
  SetOnline,
  getAllMessag,
  getThreadMessages,
  AddNewMessage,
  ReplayNewMessage,
  markMessagesAsRead,
  AddNewReminder
} = require('../controllers/Chat_controller');

const chatSocket = (io) => {
  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
      socket.join(userId);
      console.log(`User ${userId} connected with socket ${socket.id}`);
    }

    // Get all users for the chat list
    socket.on('getallUser', async (userId) => {
      try {
        const users = await getAllUser(userId);
        socket.emit('user', users);
      } catch (err) {
        socket.emit('error', { message: 'Failed to get user list', error: err });
      }
    });

    // Get all message threads between two users
    socket.on("getAllMessage", async (sender, receiver) => {
      try {
        const threads = await getAllMessag(sender, receiver);
        socket.emit('Message', threads);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get messages', error });
      }
    });

    // Get messages for a specific thread
    socket.on("getThreadMessages", async (threadId, userId) => {
      try {
        const messages = await getThreadMessages(threadId);
        await markMessagesAsRead(threadId, userId);
        socket.emit('threadMessages', { threadId, messages });
      } catch (error) {
        socket.emit('error', { message: 'Failed to get thread messages', error });
      }
    });

    // Send a new message
    socket.on("addnewMsg", async (data) => {
      try {
        const insert = await AddNewMessage(data);
        
        // Emit to both sender and receiver
        io.to(data.Sender).to(data.Receiver).emit("added", insert);
        
        // Update the thread list for both users
        const senderThreads = await getAllMessag(data.Sender, data.Receiver);
        const receiverThreads = await getAllMessag(data.Receiver, data.Sender);
        
        io.to(data.Sender).emit('Message', senderThreads);
        io.to(data.Receiver).emit('Message', receiverThreads);
      } catch (error) {
        socket.emit('error', { message: 'Failed to send message', error });
      }
    });

    // Send a reply message
    socket.on("replayMsg", async (data) => {
      try {
        const insert = await ReplayNewMessage(data);
        
        // Emit to both sender and receiver
        io.to(data.Sender).to(data.Receiver).emit("replayadded", insert);
        
        // Update the thread list for both users
        const senderThreads = await getAllMessag(data.Sender, data.Receiver);
        const receiverThreads = await getAllMessag(data.Receiver, data.Sender);
        
        io.to(data.Sender).emit('Message', senderThreads);
        io.to(data.Receiver).emit('Message', receiverThreads);
      } catch (error) {
        socket.emit('error', { message: 'Failed to send reply', error });
      }
    });

    // Mark messages as read
    socket.on("markAsRead", async ({ threadId, userId }) => {
      try {
        await markMessagesAsRead(threadId, userId);
        // Notify the sender that their messages were read
        const messages = await getThreadMessages(threadId);
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.Sender._id !== userId) {
          io.to(lastMessage.Sender._id).emit('messagesRead', { threadId });
        }
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    });

    // Online status management
    socket.on('online', async (userId) => {
      try {
        await SetOnline(userId);
        socket.broadcast.emit('userOnline', userId);
      } catch (err) {
        console.error("Online update failed", err);
      }
    });

    socket.on('offline', async (userId) => {
      try {
        await OffLine(userId);
        socket.broadcast.emit('userOffline', userId);
      } catch (err) {
        console.error("Offline update failed", err);
      }
    });


    //Reminder
   socket.on("addnewReminder", async (data, callback) => {
  try {
    const { message, sender, recipients } = data;
    
    if (!message || !sender || !recipients || !Array.isArray(recipients)) {
      throw new Error("Invalid reminder data format");
    }

    const insert = await AddNewReminder(message, sender, recipients);
    
    // Notify each recipient
    recipients.forEach(recipientId => {
      io.to(recipientId).emit("newReminder", insert);
    });
    
    // Send success response to sender
    callback({
      success: true,
      message: "Reminder set successfully",
      data: insert
    });

  } catch (error) {
    console.error("Reminder error:", error);
    callback({
      success: false,
      error: error.message
    });
  }
});

    socket.on("disconnect", async () => {
      console.log(`Client disconnected: ${socket.id}`);
      const userId = socket.handshake.query.userId;
      if (userId) {
        try {
          await OffLine(userId);
          socket.broadcast.emit('userOffline', userId);
        } catch (err) {
          console.error("Offline update on disconnect failed", err);
        }
      }
    });
  });
};

module.exports = chatSocket;