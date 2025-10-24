const express = require("express");
const router = express.Router();
const feedbackcontroller=require("../controllers/feedbackcontroller.js");

router.get("/",feedbackcontroller.getfeedbacks);
router.get("/:complaint_id",feedbackcontroller.getfeedbackbyid);
router.post("/",feedbackcontroller.addfeedback);
module.exports=router;