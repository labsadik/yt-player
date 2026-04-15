const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");

require("dotenv").config();

const app = express();
const server = http.createServer(app);

// SOCKET
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

// make io global
app.set("io", io);

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/videos", require("./routes/videos"));

// SOCKET CONNECTION
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
});

server.listen(process.env.PORT, () => {
  console.log("Server running");
});