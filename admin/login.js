import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';

const uri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET;

// Helper function to connect to MongoDB
async function connectToDatabase() {
  const client = new MongoClient(uri);
  await client.connect();
  return client;
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

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  try {
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
        message: 'Invalid email or password' 
      });
    }

    // Create JWT token
    const token = jwt.sign(
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
      message: 'Login successful',
      token,
      admin: {
        email: admin.email,
        name: admin.name,
        type: 'admin'
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
}
