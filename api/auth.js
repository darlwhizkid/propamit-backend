import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const uri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET;

// Email transporter
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Helper function to connect to MongoDB
async function connectToDatabase() {
  const client = new MongoClient(uri);
  await client.connect();
  return client;
}

// Send verification email
async function sendVerificationEmail(email, name, verificationToken) {
  const verificationUrl = `${process.env.SITE_URL}/verify-email?token=${verificationToken}`;
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify Your LegitCar Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0066cc;">Welcome to LegitCar, ${name}!</h2>
        <p>Thank you for registering with LegitCar. Please verify your email address to complete your registration.</p>
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
          If you didn't create an account with LegitCar, please ignore this email.
        </p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

// Send welcome email
async function sendWelcomeEmail(email, name) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Welcome to LegitCar - Your Account is Ready!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0066cc;">Welcome to LegitCar, ${name}!</h2>
        <p>Your account has been successfully verified and is now ready to use.</p>
        <p>You can now:</p>
        <ul>
          <li>Register your vehicles</li>
          <li>Renew documents</li>
          <li>Track applications</li>
          <li>Access all our services</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.SITE_URL}/dashboard" 
             style="background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Access Your Dashboard
          </a>
        </div>
        <p>Thank you for choosing LegitCar for your transportation documentation needs.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { action, email, password, name, phone, token } = req.body;
  
  let client;
  try {
    client = await connectToDatabase();
    const db = client.db('legitcar');
    const users = db.collection('users');

    // Register new user
    if (action === 'register') {
      // Check if user already exists
      const existingUser = await users.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already registered' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Generate verification token
      const verificationToken = jwt.sign({ email }, jwtSecret, { expiresIn: '24h' });
      
      // Create user
      const result = await users.insertOne({
        name,
        email,
        password: hashedPassword,
        phone,
        isVerified: false,
        verificationToken,
        createdAt: new Date().toISOString(),
        lastLogin: null
      });

      // Send verification email
      await sendVerificationEmail(email, name, verificationToken);

      return res.status(201).json({ 
        success: true, 
        message: 'Registration successful! Please check your email to verify your account.',
        requiresVerification: true
      });
    }
    
    // Verify email
    if (action === 'verify-email') {
      try {
        const decoded = jwt.verify(token, jwtSecret);
        const user = await users.findOne({ 
          email: decoded.email, 
          verificationToken: token 
        });

        if (!user) {
          return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
        }

        // Update user as verified
        await users.updateOne(
          { email: decoded.email },
          { 
            $set: { isVerified: true },
            $unset: { verificationToken: "" }
          }
        );

        // Send welcome email
        await sendWelcomeEmail(user.email, user.name);

        return res.status(200).json({ 
          success: true, 
          message: 'Email verified successfully! You can now log in.' 
        });
      } catch (error) {
        return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
      }
    }
    
    // Login user
    if (action === 'login') {
      const user = await users.findOne({ email });
      if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid email or password' });
      }

      if (!user.isVerified) {
        return res.status(400).json({ 
          success: false, 
          message: 'Please verify your email before logging in. Check your inbox for the verification link.' 
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ success: false, message: 'Invalid email or password' });
      }

      // Update last login
      await users.updateOne(
        { email },
        { $set: { lastLogin: new Date().toISOString() } }
      );

      // Generate JWT token
      const authToken = jwt.sign(
        { userId: user._id, email: user.email },
        jwtSecret,
        { expiresIn: '7d' }
      );

      return res.status(200).json({ 
        success: true, 
        message: 'Login successful',
        token: authToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone
        }
      });
    }

    // Forgot password
    if (action === 'forgot-password') {
      const user = await users.findOne({ email });
      if (!user) {
        // Don't reveal if email exists or not
        return res.status(200).json({ 
          success: true, 
          message: 'If an account with that email exists, a password reset link has been sent.' 
        });
      }

      // Generate reset token
      const resetToken = jwt.sign({ email }, jwtSecret, { expiresIn: '1h' });
      
      // Save reset token
      await users.updateOne(
        { email },
        { $set: { resetToken, resetTokenExpiry: new Date(Date.now() + 3600000) } }
      );

      // Send reset email
      const resetUrl = `${process.env.SITE_URL}/reset-password?token=${resetToken}`;
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Reset Your LegitCar Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0066cc;">Password Reset Request</h2>
            <p>You requested a password reset for your LegitCar account.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this reset, please ignore this email.</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);

      return res.status(200).json({ 
        success: true, 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }

    
    // Admin login
    if (action === 'admin-login') {
      // Hardcoded admin credentials
      const hardcodedAdmins = [
        { 
          email: 'admin@propamit.com', 
          password: 'admin123',
          name: 'System Administrator'
        },
        { 
          email: 'darlingtonodom@gmail.com', 
          password: 'Coldwizkid',
          name: 'Darlington Odom'
        },
        { 
          email: 'support@propamit.com', 
          password: 'support123',
          name: 'Support Administrator'
        }
      ];

      const admin = hardcodedAdmins.find(admin => 
        admin.email === email && admin.password === password
      );

      if (!admin) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid admin credentials' 
        });
      }

      // Create JWT token
      const adminToken = jwt.sign(
        { 
          adminId: admin.email, 
          email: admin.email,
          type: 'admin'
        },
        jwtSecret,
        { expiresIn: '24h' }
      );

      console.log(`Admin login successful: ${admin.email} at ${new Date().toISOString()}`);

      return res.status(200).json({
        success: true,
        message: 'Admin login successful',
        token: adminToken,
        admin: {
          email: admin.email,
          name: admin.name,
          type: 'admin'
        }
      });
    }


  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    if (client) {
      await client.close();
    }
  }
}