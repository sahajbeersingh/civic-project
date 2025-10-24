const axios = require("axios");

async function predictCategory(text) {
  try {
    const mlUrl = process.env.ML_URL || "http://127.0.0.1:5000/predict";
    const response = await axios.post(mlUrl, { text }, { headers: { "Content-Type": "application/json" }});
    return response.data.category;
  } catch (err) {
    console.error("ML Service error:", err.message);
    return "general";
  }
}

module.exports = { predictCategory };
