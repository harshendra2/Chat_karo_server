const mongoose = require("mongoose");
const validator = require("validator");

const FollowerSchema = new mongoose.Schema({
  follower:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "user"
  },
   requester:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
   },
   Status:{
    type:String,
    default:"Follower"
   },
   Block:{
    type:Boolean,
    default:false
   },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

const Follower= mongoose.model("Follower", FollowerSchema);
module.exports =Follower;
