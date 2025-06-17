const jwt=require("jsonwebtoken")
const User=require("../models/User_model")

const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    try {
      const decodedToken = jwt.verify(token, process.env.SECRET_KEY);
      const user = await User.findById(decodedToken._id);
     req.id = user;
    
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      error: "Authorization header is required",
    });
  }
};


module.exports = authenticateUser;

