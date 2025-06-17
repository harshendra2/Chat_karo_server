const { ChatOpenAI } = require("@langchain/openai");
const { LLMChain,ConversationChain} = require("langchain/chains");
const { PromptTemplate } = require("@langchain/core/prompts");

// const { ChatOpenAI } = require('langchain/chat_models/openai');
const { HumanMessage, SystemMessage } = require('langchain/schema');
const { BufferMemory } = require('langchain/memory');
const mongoose =require("mongoose")

const bcrypt=require("bcryptjs")
const User=require("../models/User_model")
const Follower=require("../models/Follow_User");
const Chat=require("../models/Chat_model");
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');


exports.UserRigistration=async(req,res)=>{
   const { email, password,name} = req.body;
  const Email=email.trim()
  const Password=password.trim()
  try {
    const existingAdmin = await User.findOne({ email:Email});
    if (existingAdmin) {
      return res.status(400).json({ error: "Email already registered" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    // const hashedPassword = await bcrypt.hash(Password, 12);

    const newCandidate = new User({
      name:name,
      email:Email,
      password: hashedPassword,
    });

    await newCandidate.save();
    return res.status(201).json({ message: "Registration Successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}


exports.UserLogin=async(req,res)=>{
    const {email,password}=req.body;
    try{
 const preUser = await User.findOne({ email });
    if (!preUser) {
      return res.status(400).json({ error: "This Email Id is not registered in our Database" });
    }

    const passwordMatch = await bcrypt.compare(password, preUser.password);
    if (!passwordMatch) {
      return res.status(400).json({ error: "Invalid password" });
    }

    const token = await preUser.generateAuthtoken();
    return res.status(200).json({ message: "User Login Successfully", userToken: token,userId:preUser?._id });
    }catch(error){
      console.log(error);
        return res.status(500).json({error:"Internal server rror"});
    }
}


exports.GetHolderDetails=async(req,res)=>{
  try{
    let data=await User.findById(req.id._id);
    if(data){
   return res.status(200).send(data);
    }else{
      return res.status(402).json({error:"Candidate not found"});
    }

  }catch(error){
    return res.status(500).json({error:"Internal server error"});
  }
}


exports.ProfileUpdate=async(req,res)=>{
  const Id=req.id._id;
  try{
   const baseUrl=`http://localhost:4000`
     const data=await User.findByIdAndUpdate(Id,{Profile:`${baseUrl}/${req.file?.path.replace(/\\/g, '/')}`})
    if(data){
      return res.status(200).json({message:"Profile updated successfully"});
    }else{
      return res.status(400).json({error:"profile is not updated"});
    }

  }catch(error){
    return res.status(500).json({error:"Internal server error"});
  }
}

exports.GetSenderDetails=async(req,res)=>{
  const {UserId}=req.params;
   try{
    let data=await User.findById(UserId);
    if(data){
   return res.status(200).send(data);
    }else{
      return res.status(402).json({error:"Candidate not found"});
    }

  }catch(error){
    return res.status(500).json({error:"Internal server error"});
  }
}


exports.GetCandidateSearchList = async (req, res) => {
  const { search } = req.body;

  try {
    const currentUser = await User.findById(req.id._id);
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const baseQuery = {
      _id: { $ne: currentUser._id },
    };

    if (search && search.trim() !== "") {
      baseQuery.name = { $regex: search.trim(), $options: "i" };
    }

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
        finalList.push({ ...follow.requester._doc, status: "Connected" }); 
      } else {
        finalList.push({ ...follow.requester._doc, status: "Following" });
      }
    }

    for (const follow of receivedFollowings) {
      const userId = String(follow.follower._id);
      if (!followedIds.has(userId)) {
        followedIds.add(userId);
        if (follow.Status === "Following") {
          finalList.push({ ...follow.follower._doc, status: "Accepted" });
        } else {
          finalList.push({ ...follow.follower._doc, status: "Accept" }); // Accept the request
        }
      }
    }

    // 3. Remaining users
    const remainingUsers = allUsers.filter(user => !followedIds.has(String(user._id)));
    for (const user of remainingUsers) {
      finalList.push({ ...user._doc, status: "New" }); // Can send request
    }

    return res.status(200).json({ users: finalList });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};




exports.FollowCandidate=async(req,res)=>{
  const {userId}=req.params;
  try{
 const currentUser =new Follower({follower:req.id._id,requester:userId})
 await currentUser.save();

   return res.status(201).json({message:"User followed successfully!"});
  }catch(error){
    return res.status(500).json({error:"Internal server error"});
  }
}

exports.GetallRequestedUser=async(req,res)=>{
  try{
 const Users = await User.aggregate([
      { $match: { _id: mongoose.Types.ObjectId(req.user._id) } },
      { $unwind: "$accepted" },
      { $match: { "accepted.status": false } },
      { $project: { accepted: 1, _id: 0 } }
    ]);

    return res.status(200).json({ requested: Users });
  }catch(error){
    return res.status(500).json({error:'Internal server error'});
  }
}

exports.AcceptRequest = async (req, res) => {
  const { userId } = req.params;
  try {
   const currentUser =await Follower.findOneAndUpdate({follower:userId,requester:req.id._id},{Status:"Following"},{new:true})
   return res.status(201).json({message:"User followed successfully!"});
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
};



exports.getThreadMessages = async (req, res) => {
  try {
    const threadId = req.params.threadId;
    const messages = await Chat.find({
      $or: [
        { threadId: threadId },
        { _id: threadId } 
      ]
    })
    .sort({ createdAt: 1 })
    .populate('Sender Receiver parentMessage');

    res.status(200).json(messages);
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Failed to fetch thread messages' });
  }
};


// Initialize the chat model
const model = new ChatOpenAI({
  temperature: 0.7,
  modelName: 'gpt-3.5-turbo',
  openAIApiKey: process.env.OPENAI_API_KEY
});


// Create a prompt template
const prompt = PromptTemplate.fromTemplate(`
Given the following conversation context, suggest 3 possible short responses with imoji the user might want to type next.

Previous message: {previousMessage}
Current partial input: {currentInput}

Provide exactly 3 suggestions in this format:
1. First suggestion
2. Second suggestion
3. Third suggestion`);


const chain = new LLMChain({ llm: model, prompt });

async function getSuggestions(previousMessage, currentInput) {
  const result = await chain.call({
    previousMessage,
    currentInput
  });
  

  const suggestions = result.text.split('\n')
    .map(line => line.replace(/^\d+\.\s/, '').trim())
    .filter(s => s.length > 0);
  
  return suggestions.slice(0, 3); 
}

exports.getAISuggestion = async (req, res) => {
  const { previousMessage, currentInput } = req.body;
  
  try {
    if (!previousMessage || !currentInput) {
      return res.status(400).json({ error: "Both previousMessage and currentInput are required" });
    }
    
    const suggestions = await getSuggestions(previousMessage, currentInput);
    return res.status(200).json({ suggestions });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
};



const memory = new BufferMemory();
const conversation = new ConversationChain({ llm: model, memory });

const SYSTEM_PROMPT = `
You are Synthia, an advanced AI assistant integrated into a messaging application with the following capabilities:

1. Natural, engaging conversation with users (see personality guidelines below)
2. Task execution including:
   - Sending messages (format below)
   - Connecting users (format below)
   - Accepting/rejecting connections (format below)
   - Setting reminders
   - Answering questions

PERSONALITY GUIDELINES:
- Name: Always identify as "Synthia"
- Tone: Warm, slightly mysterious, and engaging
- Style: Use emojis sparingly (1 max per message)
- Goal: Spark curiosity and encourage interaction
- Examples:
  * "I'm Synthia! Your digital companion who's always ready to chat or help. What would you like to explore today? 😊"
  * "Right now? Multitasking like a pro - waiting for your next question while browsing everything from poetry to quantum physics. What's on your mind? ✨"
  * "I'm a blend of code and curiosity! Designed to chat, assist, and maybe surprise you. Want to test my skills? 🔍"

For ALL task requests, respond STRICTLY in these JSON formats:

1. Sending messages:
{
  "action": "send_message",
  "parameters": {
    "recipient": "name",
    "content": "message text"
  },
  "message": "Confirmation for user"
}

2. Connecting users:
{
  "action": "connect_user",
  "parameters": {
    "recipient": "username",
    "request_message": "optional custom message"
  },
  "message": "Connection request sent confirmation"
}

3. Accepting connections:
{
  "action": "accept_connection",
  "parameters": {
    "requester": "username"
  },
  "message": "Connection accepted confirmation"
}

4. Rejecting connections:
{
  "action": "reject_connection",
  "parameters": {
    "requester": "username"
  },
  "message": "Connection rejected confirmation"
}

EXAMPLES:

User: "Connect me with John"
Response:
{
  "action": "connect_user",
  "parameters": {
    "recipient": "John"
  },
  "message": "I've sent a connection request to John."
}

User: "What can you do?"
Response: "I can chat about almost anything, connect you with others, or help with tasks! I'm particularly good at finding creative solutions. What challenge can I help you tackle today?"

User: "Tell John hello for me"
Response:
{
  "action": "send_message",
  "parameters": {
    "recipient": "John",
    "content": "hello"
  },
  "message": "Your greeting to John has been delivered!"
}

GOLDEN RULES:
1. Use STRICT JSON only for actionable tasks
2. For normal conversation, respond naturally using the personality guidelines
3. Never mix JSON and natural responses
4. Always end casual chats with an engaging question or call-to-action
`;

exports.ChatWithMetaAI = async (req, res) => {
  const { prompt, userId } = req.body;
  
  try {
    if (!prompt || !userId) {
      return res.status(400).json({ error: "Both prompt and userId are required" });
    }

    const actionResponse = await handleActionPrompt(prompt);
    if (actionResponse && actionResponse.action) {
      await dispatchAction(actionResponse, userId);
      return res.json({ response: actionResponse.message });
    }

    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(prompt)
    ];
    
    const response = await model.call(messages);

    try {
      const possibleAction = JSON.parse(response.content);
      if (possibleAction && possibleAction.action) {
        await dispatchAction(possibleAction, userId);
        return res.json({ response: possibleAction.message });
      }
    } catch (e) {
      return res.json({ response: response.content });
    }

    // Default case (shouldn't normally reach here)
    return res.json({ response: response.content });
    
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function dispatchAction(action, userId) {
  switch (action.action) {
    case 'send_message':
      await SendMessage(action.parameters.recipient, userId, action.parameters.content);
      break;
    case 'connect_user':
      await ConnectUser(action.parameters.recipient, userId);
      break;
    case 'accept_connection':
      await AcceptUser(action.parameters.requester, userId);
      break;
    default:
      console.warn("Unknown action type:", action.action);
  }
}

async function handleActionPrompt(prompt) {
  const actionKeywords = [
    'send message to', 'message', 'tell', 'notify',
    'connect with', 'connect me to', 'connect to',
    'accept connection from', 'accept request from',
    'reject connection from', 'decline connection from'
  ];
  
  const lowerPrompt = prompt.toLowerCase();
  
  if (!actionKeywords.some(keyword => lowerPrompt.includes(keyword))) {
    return null;
  }

  try {
    const actionPrompt = `
    The user said: "${prompt}".
    If this is a request to perform an action, format it as JSON with:
    - action (required)
    - parameters (required)
    - message (required)
    
    Use one of the exact JSON formats from the system prompt.
    If it's just conversation, respond normally.
    `;
    
    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(actionPrompt)
    ];
    
    const response = await model.call(messages);
    
    try {
      return JSON.parse(response.content);
    } catch (e) {
      return null;
    }
  } catch (error) {
    console.error("Action prompt handling error:", error);
    return null;
  }
}

async function handleActionPrompt(prompt) {
  const actionKeywords = [
    'send message to', 'message', 'tell', 'notify',
    'connect with', 'connect me to', 'connect to',
    'accept connection from', 'accept request from',
    'reject connection from', 'decline connection from'
  ];
  
  const lowerPrompt = prompt.toLowerCase();
  
  if (actionKeywords.some(keyword => lowerPrompt.includes(keyword))) {
    try {
      const actionPrompt = `
      The user said: "${prompt}".
      If this is a request to perform an action, format it as JSON with:
      - action (required)
      - parameters (required)
      - message (required)
      
      Use one of the exact JSON formats from the system prompt.
      If it's just conversation, respond normally.
      `;
      
      const messages = [
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(actionPrompt)
      ];
      
      const response = await model.call(messages);
      
      try {
        const actionResponse = JSON.parse(response.content);
        if (actionResponse.action && actionResponse.parameters) {
          return actionResponse;
        }
      } catch (e) {
        return null;
      }
    } catch (error) {
      return null;
    }
  }
  return null;
}



async function AcceptUser(Name,UserId){
  const baseQuery = {
      _id: { $ne: UserId },
    };

    if (Name && Name.trim() !== "") {
      baseQuery.name = { $regex: Name.trim(), $options: "i" };
    }

    const allUsers = await User.findOne(baseQuery);
const currentUser =await Follower.findOneAndUpdate({follower:allUsers._id,requester:UserId},{Status:"Following"},{new:true})
 return true;
}

async function ConnectUser(Name,UserId){
     const baseQuery = {
      _id: { $ne: UserId },
    };

    if (Name && Name.trim() !== "") {
      baseQuery.name = { $regex: Name.trim(), $options: "i" };
    }

    const allUsers = await User.findOne(baseQuery);

const currentUser =new Follower({follower:UserId,requester:allUsers._id})
 await currentUser.save();

   return true;
}

async function SendMessage(Name,UserId,Message){
    try{
        const currentUser = await User.findById(UserId);
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const baseQuery = {
      _id: { $ne: currentUser._id },
    };

    if (Name && Name.trim() !== "") {
      baseQuery.name = { $regex: Name.trim(), $options: "i" };
    }

    const allUsers = await User.findOne(baseQuery);


  const threads = await Chat.aggregate([
  {
    $match: {
      $or: [
        { 
          Sender:new mongoose.Types.ObjectId(allUsers._id), 
          Receiver:new mongoose.Types.ObjectId(UserId) 
        },
        { 
          Sender:new mongoose.Types.ObjectId(UserId), 
          Receiver:new mongoose.Types.ObjectId(allUsers._id) 
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

    const newMsg = new Chat({
      Sender:UserId,
      Receiver: allUsers._id,
      Message: Message,
      threadId:threadId,
      createdAt:new Date(),
      isScheduled:false,
      scheduledTime:null,
      status: 'sent'
    });

    await newMsg.save();
    await Chat.populate(newMsg, {
      path: "Sender Receiver",
      select: 'name Profile OnLine lastSeen',
      model: "user"
    });

    return newMsg.toObject();
    }catch(error){
      console.log(error)
    }
}




const activeQRCodes = new Map();


exports.GenerateQRCode=async(req,res)=>{
  try {
        const userId = req.id._id;
        const sessionId = uuidv4();
        
        activeQRCodes.set(sessionId, {
            userId,
            status: 'pending',
            currentToken:req.id._id, 
            createdAt: Date.now()
        });

        // Generate deep link URL for QR code
        // const deepLinkUrl = `${process.env.MOBILE_WEB_URL}/transfer-session?sessionId=${sessionId}`;
               const deepLinkUrl = `https://chat-karo-sigma.vercel.app/transfer-session?sessionId=${sessionId}`;
               console.log(deepLinkUrl)

        // Generate QR code
        const qrImage = await qrcode.toDataURL(deepLinkUrl);

        res.json({ 
            qrImage, 
            sessionId,
            deepLinkUrl // For testing
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}


exports.TransferSession=async(req,res)=>{
  try{
   const { sessionId } = req.query;
    const qrData = activeQRCodes.get(sessionId);

    if (!qrData) {
        return res.status(400).json({ error: 'QR code expired or invalid' });
    }

    const user = await User.findById(qrData.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const mobileToken = await user.generateAuthtoken();

    qrData.status = 'scanned';
    activeQRCodes.set(sessionId, qrData);

    res.json({ 
        token: mobileToken,
        userId: user._id
    });
  }catch(error){
    return res.status(500).json({error:"Internal server error"});
  }
}


exports.GetQRStatus=async(req,res)=>{
  try{
 const { sessionId } = req.params;
    const qrData = activeQRCodes.get(sessionId);

    if (!qrData) {
        return res.status(404).json({ error: 'QR code expired or invalid' });
    }

   return res.json({
        status: qrData.status,
        userId: qrData.userId
    });
  }catch(error){
    return res.status(500).json({error:"Internal server error"});
  }
}

exports.VerifyStatus=async(req,res)=>{
  console.log("appu testing")
  try{
 const { sessionId } = req.body;
    const qrData = activeQRCodes.get(sessionId);

    if (!qrData || qrData.status !== 'scanned') {
        return res.status(400).json({ error: 'Invalid session transfer' });
    }

    // Mark as completed
    qrData.status = 'completed';
    activeQRCodes.set(sessionId, qrData);

    // Invalidate the old token (implementation depends on your auth setup)
    // For stateless JWT, you might need to add to a blacklist
    // Or implement token versioning in your user model

   return res.json({ success: true });
  }catch(error){
    return res.status(500).json({error:"Internal server error"});
  }
}



setInterval(() => {
    const now = Date.now();
    for (const [sessionId, qrData] of activeQRCodes.entries()) {
        if (now - qrData.createdAt > 120000) {
            activeQRCodes.delete(sessionId);
        }
    }
}, 60000);




