const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  Sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  Receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  Message: {
    type: String,
    required: true
  },
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  parentMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat'
  },
  isScheduled: {
    type: Boolean,
    default: false
  },
  scheduledTime: {
    type: Date
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
});

// Indexes for better performance
chatSchema.index({ threadId: 1, createdAt: 1 });
chatSchema.index({ Sender: 1, Receiver: 1 });
chatSchema.index({ status: 1 });

// Virtual for reply count
chatSchema.virtual('replyCount', {
  ref: 'Chat',
  localField: '_id',
  foreignField: 'parentMessage',
  count: true
});

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;