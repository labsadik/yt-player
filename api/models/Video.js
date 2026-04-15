const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema({
  no: Number,
  id: { type: String, required: true },
  title: String,
  thumbnail: String,
  duration: String
}, { timestamps: true });

module.exports = mongoose.model("Video", videoSchema);