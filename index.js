require("dotenv").config();

const mongoose = require("mongoose");


const User = require("./models/User");
const Notes = require("./models/Notes");

const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { authenticateToken } = require("./utilities");

app.use(express.json());

app.use(
  cors({
    origin: "*",
  })
);

// Gunakan MongoDB URI dari .env
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));
app.post("/create-account", async (req, res) => {
  const { fullname, email, password } = req.body;

  if (!fullname) {
    return res.status(400).json({ message: "Fullname is required" });
  }
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }
  const isUser = await User.findOne({ email });

  if (isUser) {
    return res.status(400).json({ message: "User already exists" });
  }

  const user = new User({ fullname, email, password });

  await user.save();

  const accesToken = jwt.sign({ user }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "3600m",
  });

  return res.json({
    error: false,
    user,
    accesToken,
    message: "User created successfully",
  });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }
  const userInfo = await User.findOne({ email });
  if (!userInfo) {
    return res.status(400).json({ message: "User does not exist" });
  }
  if (userInfo.email == email && userInfo.password == password) {
    const user = { user: userInfo };
    const accesToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "3600m",
    });
    return res.json({
      error: false,
      message: "User logged in successfully",
      email,
      accesToken,
    });
  } else {
    return res.status(400).json({ message: "Invalid credentials" });
  }
});

app.get("/get-user", authenticateToken, async (req, res) => {
  const { user } = req.user;
  const isUser = await User.findOne({ email: user.email });
  if (!isUser) {
    return res.status(400).json({ message: "User does not exist" });
  }
  return res.json({
    error: false,
    message: "User fetched successfully",
    user,
  });
});

// app.get("/search-notes/", authenticateToken, async (req, res) => {
//   const { _id } = req.user; // Mengambil user ID dari req.user
//   const { query } = req.query;

//   if (!query) {
//     return res
//       .status(400)
//       .json({ error: true, message: "Search query is required" });
//   }

//   try {
//     const matchingNotes = await Notes.find({
//       userId: _id,
//       $or: [
//         { title: { $regex: new RegExp(query, "i") } },
//         { content: { $regex: new RegExp(query, "i") } },
//       ],
//     });

//     return res.json({ error: false, notes: matchingNotes }); // Mengirim hasil ke response
//   } catch (error) {
//     return res.status(500).json({
//       error: true,
//       message: "Internal Server Error",
//     });
//   }
// });

app.get("/notes", authenticateToken, async (req, res) => {
  const { user } = req.user;
  try {
    const notes = await Notes.find({ userId: user._id });
    return res.json({
      error: false,
      message: "Notes fetched successfully",
      notes,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  }
});

app.post("/add-note", authenticateToken, async (req, res) => {
  const { title, content, tags } = req.body;
  const { user } = req.user;
  if (!title) {
    return res.status(400).json({ message: "Title is required" });
  }
  if (!content) {
    return res.status(400).json({ message: "Content is required" });
  }
  const note = new Notes({
    title,
    content,
    tags: tags || [],
    userId: user._id,
  });
  try {
    await note.save();
    return res.json({
      error: false,
      message: "Note added successfully",
      note,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  }
});
app.put("/edit-note/:noteId", authenticateToken, async (req, res) => {
  const { noteId } = req.params;
  const { title, content, tags, isPinned } = req.body;
  const { user } = req.user;
  if (!title && !content && !tags) {
    return res.status(400).json({ message: "No Change provided" });
  }
  try {
    const note = await Notes.findOne({ _id: noteId, userId: user._id });
    if (!note) {
      return res.status(400).json({ message: "Note not found" });
    }
    if (title) {
      note.title = title;
    }
    if (content) {
      note.content = content;
    }
    if (tags) {
      note.tags = tags;
    }
    if (isPinned) {
      note.isPinned = isPinned;
    }
    await note.save();
    return res.json({
      error: false,
      message: "Note updated successfully",
      note,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  }
});

app.delete("/delete-note/:noteId", authenticateToken, async (req, res) => {
  const { noteId } = req.params;
  const { user } = req.user;
  try {
    const note = await Notes.findOne({ _id: noteId, userId: user._id });
    if (!note) {
      return res.status(400).json({ message: "Note not found" });
    }
    await note.deleteOne({ _id: noteId, userId: user._id });
    return res.json({
      error: false,
      message: "Note deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  }
});

app.put("/update-note-pinned/:noteId", authenticateToken, async (req, res) => {
  const { noteId } = req.params;
  const { isPinned } = req.body;
  const { user } = req.user;

  try {
    const note = await Notes.findOne({ _id: noteId, userId: user._id });
    if (!note) {
      return res.status(400).json({ error: true, message: "Note not found" });
    }
    if (isPinned) {
      note.isPinned = isPinned;
    }
    await note.save();
    return res.json({
      error: false,
      message: "Note pinned successfully",
      note,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  }
});

app.listen(8000, () => {
  console.log("Server is running on port 8000");
});

module.exports = app;
