const express = require("express");
const router = express.Router();
const complaintcontroller = require("../controllers/complaintcontroller.js");
const validatecomplaint = require('../middleware/validatecomplaint');

router.get("/",complaintcontroller.getcomplaints);
router.get("/:id",complaintcontroller.getcomplaintbyid);
router.post("/",validatecomplaint,complaintcontroller.createcomplaint);
router.patch("/:id",complaintcontroller.updatecomplaint);
module.exports = router;