import { handleCors } from '../../utils/cors.js';
import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) {
    return;
  }
  
  // Check authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded.isAdmin && decoded.email !== 'admin@propamit.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db('propamit');
    const users = await db.collection('users').find({}).toArray();
    
    await client.close();
    
    res.status(200).json({ 
      success: true, 
      users: users 
    });
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get users' 
    });
  }
}
