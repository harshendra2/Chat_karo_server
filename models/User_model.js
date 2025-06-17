const mongoose = require("mongoose");
const jwt = require('jsonwebtoken');
const validator = require("validator");

const SECRET_KEY = process.env.SECRET_KEY;

const UserSchema = new mongoose.Schema({
  name:{
    type:String,
    required:true
  },
  email: {
    type: String,
    unique: true,
    validate(value) {
      if (!validator.isEmail(value)) {
        throw new Error("Not Valid Email");
      }
    },
  },
  password: {
    type: String,
    minlength:6,
  },
  Profile:{
    type:String
  },
  OnLine:{
    type:Boolean,
    default:false
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

UserSchema.methods.generateAuthtoken = async function() {
  try {
    const token = jwt.sign({ _id: this._id,email:this.email }, SECRET_KEY, { expiresIn: '30d' });
    return token;
  } catch (error) {
    throw new Error('Token generation failed');
  }
};

const user = mongoose.model("user", UserSchema);
module.exports =user;
