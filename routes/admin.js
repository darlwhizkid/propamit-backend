import { getDB, connectDB } from "../db/connectDB.js";
import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();
const jwtSecret = process.env.JWT_SECRET;

// Admin authentication middleware
const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, jwtSecret);

    if (!decoded.isAdmin && decoded.email !== "admin@propamit.com") {
      return res.status(403).json({ error: "Admin access required" });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// GET /api/v1/admin/users - Get all users
router.get("/users", async (req, res) => {
  try {
    const db = getDB();
    const users = await db.collection("users").find({}).toArray();

    res.json({
      success: true,
      users: users,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get users",
    });
  }
});

// GET /api/v1/admin/stats - Dashboard statistics
router.get("/stats", async (req, res) => {
  try {
    console.log("Stats route called");

    // Ensure database connection
    const db = await connectDB();
    console.log("Database connection established");

    const totalUsers = await db.collection("users").countDocuments();
    const totalApplications = await db
      .collection("applications")
      .countDocuments();
    const totalMessages = await db.collection("messages").countDocuments();
    const totalDocuments = await db.collection("documents").countDocuments();

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalApplications,
        totalMessages,
        totalDocuments,
      },
    });
  } catch (error) {
    console.error("Stats route error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get stats",
      details: error.message,
    });
  }
});

// GET /api/v1/admin/recent-activity - Recent activity
router.get("/recent-activity", async (req, res) => {
  try {
    const db = getDB();

    // Get recent activities (placeholder)
    const activities = await db
      .collection("activities")
      .find({})
      .sort({ date: -1 })
      .limit(10)
      .toArray();

    res.json({
      success: true,
      activities: activities || [],
    });
  } catch (error) {
    console.error("Get recent activity error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get recent activity",
    });
  }
});

// POST /api/v1/admin/reset-database
router.post("/reset-database", async (req, res) => {
  try {
    const db = getDB();

    // Reset collections
    const collections = ["users", "applications", "messages", "documents"];
    let deletedCounts = {};

    for (const collectionName of collections) {
      const result = await db.collection(collectionName).deleteMany({});
      deletedCounts[collectionName] = result.deletedCount;
    }

    res.json({
      success: true,
      message: "Database reset successfully",
      deletedCounts,
    });
  } catch (error) {
    console.error("Reset database error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reset database",
    });
  }
});

// DELETE /api/v1/admin/users/:id - Delete a user
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();
    const users = db.collection("users");

    // Convert string ID to ObjectId
    const { ObjectId } = await import("mongodb");
    const userId = new ObjectId(id);

    const result = await users.deleteOne({ _id: userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting user",
    });
  }
});

// POST /api/v1/admin/login - Admin login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Hardcoded admin credentials (you can enhance this later)
    const adminCredentials = [
      { email: "admin@propamit.com", password: "admin123" },
      { email: "darlingtonodom@gmail.com", password: "Coldwizkid" },
      { email: "support@propamit.com", password: "support123" },
    ];

    const admin = adminCredentials.find(
      (a) => a.email === email && a.password === password
    );

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin credentials",
      });
    }

    // Create JWT token
    const token = jwt.sign(
      {
        email: admin.email,
        isAdmin: true,
      },
      jwtSecret,
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      message: "Admin login successful",
      token: token,
      admin: {
        email: admin.email,
        name: "Administrator",
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during admin login",
    });
  }
});

export default router;
