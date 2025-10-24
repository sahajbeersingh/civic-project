require('dotenv').config();
const express = require("express");
const app=express();
const supabase = require('./config/supabaseClient.js');
app.use(express.json());

const cors = require('cors');
app.use(cors({ origin: '*' }));

const complaintroutes = require("./routes/complaintroutes");
app.use("/api/complaints", complaintroutes);

const feedbackroutes = require("./routes/feedbackroutes");
app.use("/api/feedback", feedbackroutes);

const uploadroutes = require("./routes/uploadroutes");
app.use("/api/upload",uploadroutes);

app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({ error: err.message || "Server Error" });
});

app.listen(process.env.port,()=>{
    console.log(`Server running on http://localhost:${process.env.port}`);
})