const express = require("express");
const multer = require("multer");
const supabase = require("../config/supabaseClient");
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post("/", upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    if (!file)return res.status(400).json({ error: "No file uploaded" });

    const fileName = `${Date.now()}_${file.originalname}`;
    const { data, error } = await supabase.storage
      .from("complaint-images")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from("complaint-images")
      .getPublicUrl(fileName);

    res.json({
      success: true,
      image_url: publicUrlData.publicUrl,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
