const { ChatOpenAI } = require("@langchain/openai");
const { LLMChain } = require("langchain/chains");
const { PromptTemplate } = require("@langchain/core/prompts");

const User = require("../models/User_model");
const Chat = require("../models/Chat_model");
const mongoose = require("mongoose");
const Follower=require("../models/Follow_User")


exports.getAllUser = async (UserId) => {
   try{
        const currentUser = await User.findById(UserId);
    if (!currentUser) {
      return []
    }
    currentUser.OnLine=true;
    await currentUser.save();

    const baseQuery = {
      _id: { $ne: currentUser._id },
    };

    const allUsers = await User.find(baseQuery);
    const userIds = allUsers.map(user => user._id);

    const sentFollowings = await Follower.find({
      follower: currentUser._id,
      requester: { $in: userIds },
    }).populate("requester");

    const receivedFollowings = await Follower.find({
      requester: currentUser._id,
      follower: { $in: userIds },
    }).populate("follower");

    const followedIds = new Set();

    const finalList = [];

    for (const follow of sentFollowings) {
      followedIds.add(String(follow.requester._id));
      if (follow.Status === "Following") {
        finalList.push({ ...follow.requester._doc}); 
      }
    }

    for (const follow of receivedFollowings) {
      const userId = String(follow.follower._id);
      if (!followedIds.has(userId)) {
        followedIds.add(userId);
        if (follow.Status === "Following") {
          finalList.push({ ...follow.follower._doc});
        }
      }
    }

    return finalList || [];
    }catch(error){
      console.log(error);
    }
};






exports.OffLine = async (UserId) => {
  try {
    await User.findByIdAndUpdate(UserId, { OnLine: false, lastSeen: new Date() });
    return true;
  } catch (error) {
    console.error("Error in OffLine:", error);
    return false;
  }
};

exports.SetOnline = async (UserId) => {
  try {
    await User.findByIdAndUpdate(UserId, { OnLine: true, lastSeen: null });
    return true;
  } catch (error) {
    console.error("Error in SetOnline:", error);
    return false;
  }
};

exports.getAllMessag = async (sender, receiver) => {
  try {
  
 const threads = await Chat.aggregate([
  {
    $match: {
      $or: [
        { 
          Sender:new mongoose.Types.ObjectId(sender), 
          Receiver:new mongoose.Types.ObjectId(receiver) 
        },
        { 
          Sender:new mongoose.Types.ObjectId(receiver), 
          Receiver:new mongoose.Types.ObjectId(sender) 
        }
      ]
    }
  },
  {
    $group: {
      _id: "$threadId",
      lastMessage: { $last: "$$ROOT" },
      count: { $sum: 1 }
    }
  },
  {
    $sort: { "lastMessage.createdAt": -1 }
  }
]);

    await Chat.populate(threads, {
      path: "lastMessage.Sender lastMessage.Receiver",
      select: 'name Profile OnLine lastSeen',
      model: "user"
    });

    return threads || [];
  } catch (error) {
    console.error("Error in getAllMessag:", error);
    return [];
  }
};

exports.getThreadMessages = async (threadId) => {
  try {
    const messages = await Chat.find({ threadId })
      .sort({ createdAt: 1 })
      .populate('Sender Receiver', 'name Profile OnLine lastSeen')
      .populate({
        path: 'parentMessage',
        populate: {
          path: 'Sender',
          select: 'name Profile'
        }
      })
      .lean();

    return messages || [];
  } catch (error) {
    console.error("Error in getThreadMessages:", error);
    return [];
  }
};

exports.AddNewMessage = async (data) => {
  try {
    // Generate a thread ID if not provided (for new conversations)
    if (!data.threadId) {
      data.threadId = new mongoose.Types.ObjectId();
    }

    const newMsg = new Chat({
      Sender: data.Sender,
      Receiver: data.Receiver,
      Message: data.Message,
      threadId: data.threadId,
      createdAt: data.createdAt || new Date(),
      isScheduled: data.isScheduled || false,
      scheduledTime: data.scheduledTime || null,
      status: 'sent'
    });

    await newMsg.save();
    await Chat.populate(newMsg, {
      path: "Sender Receiver",
      select: 'name Profile OnLine lastSeen',
      model: "user"
    });

    return newMsg.toObject();
  } catch (error) {
    throw error;
  }
};

exports.ReplayNewMessage = async (data) => {
  try {
    const parentMessage = await Chat.findById(data.parentMessageId);
    if (!parentMessage) {
      throw new Error("Parent message not found");
    }

    const reply = new Chat({
      Sender: data.Sender,
      Receiver: data.Receiver,
      Message: data.Message,
      threadId: data.threadId || parentMessage.threadId,
      parentMessage: data.parentMessageId,
      createdAt: data.createdAt || new Date(),
      isScheduled: data.isScheduled || false,
      scheduledTime: data.scheduledTime || null,
      status: 'sent'
    });

    await reply.save();
    
    // Populate all necessary fields
    await Chat.populate(reply, [
      { path: "Sender Receiver", select: 'name Profile OnLine lastSeen', model: "user" },
      { 
        path: "parentMessage",
        populate: {
          path: 'Sender',
          select: 'name Profile'
        }
      }
    ]);

    return reply.toObject();
  } catch (error) {
    console.error("Error in ReplayNewMessage:", error);
    throw error;
  }
};

exports.markMessagesAsRead = async (threadId, userId) => {
  try {
    await Chat.updateMany(
      { 
        threadId,
        Receiver: userId,
        status: { $ne: 'read' }
      },
      { $set: { status: 'read' } }
    );
    return true;
  } catch (error) {
    return false;
  }
};


const model = new ChatOpenAI({
  temperature: 0.7,
  modelName: 'gpt-3.5-turbo',
  openAIApiKey: process.env.OPENAI_API_KEY
});

// Corrected prompt template - use single braces for variables, double for literals
const prompt = PromptTemplate.fromTemplate(`
You are an advanced reminder parsing assistant. Analyze the following message:

{message}

Extract:
1. Purpose (meeting/event/task)
2. All dates/times (ISO format)
3. Action items
4. Message sending proper format to users

Return as VALID JSON ONLY with this structure:
{{
  "original_message": "...",
  "type": "...",
  "title": "...",
  "dates": [...],
  "action_items": [...],
  "Message_sending_format": "..."
}}

Example Input: "Team sync tomorrow at 10AM"
Example Output:
{{
  "original_message": "Team sync tomorrow at 10AM",
  "type": "meeting",
  "title": "Team Sync",
  "dates": [{{
    "iso": "2023-06-11T10:00:00Z",
    "natural": "tomorrow at 10AM"
  }}],
  "action_items": ["Prepare agenda"],
  "Message_sending_format": "Subject: Reminder: Team Sync Tomorrow at 10AM\\n\\nHi All,\\n\\nJust a quick reminder about our team sync tomorrow at 10:00 AM.\\n\\nAgenda:\\n- Progress updates\\n- Roadmap discussion\\n\\nPlease prepare your updates in advance.\\n\\nBest regards"
}}
`);

const chain = new LLMChain({ llm: model, prompt });

async function getExtractedData(message, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await chain.call({ message: message });
      const parsed = typeof result.text === 'string' ? JSON.parse(result.text) : result;
      return {
        ...parsed,
        dates: parsed.dates?.map(date => ({
          iso: date.iso || '',
          natural: date.natural || ''
        })) || []
      };
    } catch (error) {
      if (i === retries - 1) {
        throw new Error('Failed to process reminder: ' + error.message);
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

exports.AddNewReminder = async (message, sender, recipients) => {
  try {
    if (!message || typeof message !== 'string') {
      throw new Error('Valid message content is required');
    }
    if (!Array.isArray(recipients)) {
      throw new Error('Recipients must be an array');
    }

    const result = await getExtractedData(message.trim());
   
    if (!result?.Message_sending_format || !result.dates?.[0]?.iso) {
      throw new Error('Failed to extract valid reminder data');
    }

    const scheduledTime = new Date(result.dates[0].iso);
  

    const sendPromises = recipients.map(async (recipientId) => {

       const threads = await Chat.aggregate([
  {
    $match: {
      $or: [
        { 
          Sender:new mongoose.Types.ObjectId(sender), 
          Receiver:new mongoose.Types.ObjectId(recipientId) 
        },
        { 
          Sender:new mongoose.Types.ObjectId(recipientId), 
          Receiver:new mongoose.Types.ObjectId(sender) 
        }
      ]
    }
  },
  {
    $group: {
      _id: "$threadId",
      lastMessage: { $last: "$$ROOT" },
      count: { $sum: 1 }
    }
  },
  {
    $sort: { "lastMessage.createdAt": -1 }
  }
]);

    await Chat.populate(threads, {
      path: "lastMessage.Sender lastMessage.Receiver",
      select: 'name Profile OnLine lastSeen',
      model: "user"
    });
    
       const threadId = threads.length > 0 ? threads[0].lastMessage.threadId : new mongoose.Types.ObjectId();
      const chatMessage = new Chat({
        Sender: sender,
        Receiver: recipientId,
        Message: result.Message_sending_format,
        threadId: threadId,
        createdAt:scheduledTime,
        isScheduled: true,
        scheduledTime: scheduledTime,
        isReminder: true
      });

      const savedMessage = await chatMessage.save();
      
      await Chat.populate(savedMessage, {
        path: "Sender Receiver",
        select: 'name Profile OnLine lastSeen',
        model: "user"
      });

      return savedMessage.toObject();
    });

    const sentMessages = await Promise.all(sendPromises);

    return {
      success: true,
      messages: sentMessages,
      reminderDetails: result
    };
    
  } catch (error) {
    throw error; 
  }
};