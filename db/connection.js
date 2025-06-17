const mongoose = require("mongoose");

// const URL="mongodb://localhost:27017/chat_karoo"
const URL="mongodb+srv://harsendraraj20:DvSxvgPhKtA5sCox@cluster0.jfaf3ux.mongodb.net/"
// Connect to MongoDB
mongoose
  .connect(URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Database connected"))
  .catch((error) => {
    console.error("Database connection error:", error);
  });