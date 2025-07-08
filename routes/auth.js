import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { getDB } from "../db/connectDB.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

const router = express.Router();
const jwtSecret = process.env.JWT_SECRET;
console.log("🔍 Auth.js - JWT_SECRET:", jwtSecret ? "LOADED" : "UNDEFINED");

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send verification email
async function sendVerificationEmail(email, name, verificationToken) {
  const verificationUrl = `${process.env.SITE_URL}/verify-email?token=${verificationToken}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Verify Your Propamit Account",
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0066cc;">Welcome to Propamit, ${name}!</h2>
                <p>Thank you for registering with Propamit. Please verify your email address to complete your registration.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationUrl}" 
                       style="background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Verify Email Address
                    </a>
                </div>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
                <p>This link will expire in 24 hours.</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">
                    If you didn't create an account with Propamit, please ignore this email.
                </p>
            </div>
        `,
  };

  await transporter.sendMail(mailOptions);
}

// POST /api/v1/auth/register
router.post("/register", async (req, res) => {
  console.log("🚀 Registration route hit!", req.body);
  console.log("Environment check:", {
  mongoUri: process.env.MONGODB_URI ? "SET" : "NOT SET",
  jwtSecret: process.env.JWT_SECRET ? "SET" : "NOT SET"
});


  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    // Ensure database connection
    await connectDB();
    const db = getDB();
    const users = db.collection("users");

    // Check if user already exists
    const existingUser = await users.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate verification token
    // const verificationToken = jwt.sign({ email }, jwtSecret, {
    //   expiresIn: "24h",
    // });

    // Create user
    const result = await users.insertOne({
      name,
      email,
      password: hashedPassword,
      phone,
      isVerified: true,
      // verificationToken,
      createdAt: new Date().toISOString(),
      lastLogin: null,
    });

    // Send verification email
    // await sendVerificationEmail(email, name, verificationToken);

    return res.status(201).json({
      success: true,
      message: "Registration successful! You can now login.",
      requiresVerification: false,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
});

// POST /api/v1/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Ensure database connection
    await connectDB();
    const db = getDB();
    const users = db.collection("users");

    // Find user
    const user = await users.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if email is verified
    if (!user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Please verify your email address before logging in",
      });
    }

    // Update last login
    await users.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date().toISOString() } }
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      jwtSecret,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
});

// POST /api/v1/auth/verify-email
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret);
    const email = decoded.email;

    // Ensure database connection
    await connectDB();
    const db = getDB();
    const users = db.collection("users");

    // Find and update user
    const result = await users.updateOne(
      { email, verificationToken: token },
      {
        $set: {
          isVerified: true,
          emailVerifiedAt: new Date().toISOString(),
        },
        $unset: { verificationToken: 1 },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    return res.json({
      success: true,
      message: "Email verified successfully! You can now log in.",
    });
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    console.error("Email verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during email verification",
    });
  }
});

export default router;
