import { MongoClient, ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';

const uri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET;

// Helper function to connect to MongoDB
async function connectToDatabase() {
  const client = new MongoClient(uri);
  await client.connect();
  return client;
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, jwtSecret);
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  let client;
  try {
    client = await connectToDatabase();
    const db = client.db('legitcar');
    
    // Get user data
    const userId = decoded.userId;
    
    // Get vehicles
    const vehicles = await db.collection('vehicles')
      .find({ userId })
      .toArray();
    
    // Get activities
    const activities = await db.collection('activities')
      .find({ userId })
      .sort({ date: -1 })
      .toArray();
    
    // Get notifications
    const notifications = await db.collection('notifications')
      .find({ userId })
      .sort({ date: -1 })
      .toArray();
    
    // Get user profile
    const user = await db.collection('users')
      .findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Return all data
    return res.status(200).json({
      success: true,
      data: {
        profile: {
          name: user.name,
          email: user.email,
          phone: user.phone
        },
        vehicles,
        activities,
        notifications
      }
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    if (client) {
      await client.close();
    }
  }
}