require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const path=require('path')
require("./db/connection");

const PORT = 4000;

const chatSocket = require('./Sockets/chatSockets');
const VideoSocket=require("./Sockets/videoCallSockets");

// Middleware
app.use(express.json({ limit: "500mb" })); 
app.use(express.urlencoded({ extended: true, limit: "500mb" }));

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = ["http://localhost:5173", "http://65.20.91.47", "http://65.20.91.47:8001", "http://localhost:5174","https://boardsearch.ai"];
    if(!origin ||allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Access Restricted: Unauthorized origin."));
    }
  },
};

app.use(cors("*"));
app.use('/Images', express.static(path.join(__dirname, 'Images')));

app.use('/api',require("./routes/user_routes"));


const server=app.listen(PORT,'0.0.0.0', () => {
  console.log(`Server Start at port No: ${PORT}`);
});

const io = require("socket.io")(server, {
  cors:'*'
});


chatSocket(io);
VideoSocket(io);
