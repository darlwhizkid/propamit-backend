import { handleCors } from '../../utils/cors.js';
import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) {
    return; // Preflight request handled
  }
  
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Check authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    // Verify admin token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Check if user is admin
      if (!decoded.isAdmin && decoded.email !== 'admin@propamit.com') {
        return res.status(403).json({ error: 'Forbidden - Admin access required' });
      }
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Connect to MongoDB
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db('propamit');
    
    // Reset collections
    const collections = ['users', 'applications', 'messages', 'documents'];
    let deletedCounts = {};
    
    for (const collectionName of collections) {
      try {
        const result = await db.collection(collectionName).deleteMany({});
        deletedCounts[collectionName] = result.deletedCount;
      } catch (error) {
        console.log(`Collection ${collectionName} might not exist:`, error.message);
        deletedCounts[collectionName] = 0;
      }
    }
    
    await client.close();
    
    console.log('Database reset completed:', deletedCounts);
    
    res.status(200).json({ 
      success: true, 
      message: 'Database reset successfully',
      deletedCounts: deletedCounts
    });
    
  } catch (error) {
    console.error('Reset database error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reset database',
      details: error.message
    });
  }
}
