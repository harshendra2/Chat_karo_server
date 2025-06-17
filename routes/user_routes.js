const express=require('express');
const router=new express.Router();
const controller=require('../controllers/User_controller');
const {upload}= require("../middleware/Profile");
const authenticateUser=require("../Utilities/authnticUser");

router.post('/signup',controller.UserRigistration);
router.post("/login",controller.UserLogin);

router.get("/holder/details/:id",authenticateUser,controller.GetHolderDetails);
router.post("/update-profile/:id",authenticateUser,upload,controller.ProfileUpdate);
router.get("/Sender/details/:UserId",controller.GetSenderDetails);

router.post("/candidate/search/:id",authenticateUser,controller.GetCandidateSearchList);

router.put("/candidate/status/follow/:id/:userId",authenticateUser,controller.FollowCandidate);

router.get("/candidate/request/user/:id",authenticateUser,controller.GetallRequestedUser);

router.put("/candidate/accept/request/:id/:userId",authenticateUser,controller.AcceptRequest);


router.get('/thread/:threadId',controller.getThreadMessages);

//Ai Suggestion

router.post("/get-suggestions",controller.getAISuggestion)

// Meta AI
router.put("/get/meta/ai",controller.ChatWithMetaAI);



//QR SCanning
router.get('/generate-qr', authenticateUser,controller.GenerateQRCode);
router.get('/transfer-session',controller.TransferSession);
router.get('/qr-status/:sessionId',authenticateUser,controller.GetQRStatus);
router.post('/verify-transfer',authenticateUser,controller.VerifyStatus);

module.exports=router;