const express = require("express");
const Video = require("../models/Video");
const auth = require("../middleware/auth");

const router = express.Router();


// =======================
// GET ALL VIDEOS (PRO)
// Pagination + Search
// =======================
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const search = req.query.search || "";

    const query = search
      ? { title: { $regex: search, $options: "i" } }
      : {};

    const videos = await Video.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Video.countDocuments(query);

    res.json({
      videos,
      total,
      page,
      pages: Math.ceil(total / limit)
    });

  } catch (err) {
    res.status(500).json({ msg: "Failed to load videos" });
  }
});


// =======================
// ADD VIDEO (ADMIN ONLY + SOCKET)
// =======================
router.post("/", auth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ msg: "Admin only" });
    }

    const { id, title, duration } = req.body;

    if (!id || !title) {
      return res.status(400).json({ msg: "ID and title required" });
    }

    const video = new Video({
      no: (await Video.countDocuments()) + 1,
      id,
      title,
      duration,
      thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`
    });

    await video.save();

    // 🔥 REAL-TIME EMIT (Socket.io)
    req.app.get("io")?.emit("video-added", video);

    res.json(video);

  } catch (err) {
    res.status(500).json({ msg: "Error adding video" });
  }
});


// =======================
// UPDATE VIDEO (ADMIN ONLY + SOCKET)
// =======================
router.put("/:id", auth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ msg: "Admin only" });
    }

    const { id, title, duration } = req.body;

    const updateData = {};

    if (id) {
      updateData.id = id;
      updateData.thumbnail = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }

    if (title) updateData.title = title;
    if (duration) updateData.duration = duration;

    const video = await Video.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!video) {
      return res.status(404).json({ msg: "Video not found" });
    }

    // 🔥 REAL-TIME UPDATE EVENT
    req.app.get("io")?.emit("video-updated", video);

    res.json(video);

  } catch (err) {
    res.status(500).json({ msg: "Update failed" });
  }
});


// =======================
// DELETE VIDEO (ADMIN ONLY + SOCKET)
// =======================
router.delete("/:id", auth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ msg: "Admin only" });
    }

    const video = await Video.findByIdAndDelete(req.params.id);

    if (!video) {
      return res.status(404).json({ msg: "Video not found" });
    }

    // 🔥 REAL-TIME DELETE EVENT
    req.app.get("io")?.emit("video-deleted", req.params.id);

    res.json({ msg: "Video deleted successfully" });

  } catch (err) {
    res.status(500).json({ msg: "Delete failed" });
  }
});

module.exports = router;