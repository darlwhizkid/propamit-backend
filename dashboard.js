import { MongoClient, ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';

const uri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET;

// Middleware to verify JWT token
function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }
  
  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, jwtSecret);
  return decoded;
}

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

  let client;
  try {
    // Verify authentication
    const decoded = verifyToken(req);
    const userId = decoded.userId;

    client = await connectToDatabase();
    const db = client.db('legitcar');

    const { action } = req.body;

    // Get Dashboard Overview Data
    if (action === 'getDashboardData') {
      const [user, applications, documents, messages] = await Promise.all([
        db.collection('users').findOne({ _id: new ObjectId(userId) }),
        db.collection('applications').find({ userId: new ObjectId(userId) }).toArray(),
        db.collection('documents').find({ userId: new ObjectId(userId) }).toArray(),
        db.collection('messages').find({ userId: new ObjectId(userId), isRead: false }).toArray()
      ]);

      const stats = {
        totalApplications: applications.length,
        approvedApplications: applications.filter(app => app.status === 'approved').length,
        pendingApplications: applications.filter(app => app.status === 'pending' || app.status === 'processing').length,
        unreadMessages: messages.length,
        recentApplications: applications.slice(-5).reverse(),
        user: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.profile?.avatar || null,
          isNewUser: applications.length === 0
        }
      };

      return res.status(200).json({ success: true, data: stats });
    }

    // Get Applications
    if (action === 'getApplications') {
      const applications = await db.collection('applications')
        .find({ userId: new ObjectId(userId) })
        .sort({ submittedAt: -1 })
        .toArray();

      return res.status(200).json({ success: true, data: applications });
    }

    // Create New Application
    if (action === 'createApplication') {
      const { type, vehicleInfo, documents } = req.body;
      
      // Generate application ID
      const applicationId = `APP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      const newApplication = {
        userId: new ObjectId(userId),
        applicationId,
        type,
        status: 'pending',
        submittedAt: new Date(),
        updatedAt: new Date(),
        data: {
          vehicleInfo,
          documents: documents || [],
          notes: ''
        },
        timeline: [{
          status: 'pending',
          message: 'Application submitted successfully',
          date: new Date(),
          updatedBy: 'system'
        }]
      };

      const result = await db.collection('applications').insertOne(newApplication);
      
      // Create notification message
      await db.collection('messages').insertOne({
        userId: new ObjectId(userId),
        subject: 'Application Submitted',
        message: `Your application ${applicationId} has been submitted successfully and is being reviewed.`,
        isRead: false,
        type: 'system',
        createdAt: new Date(),
        from: 'system'
      });

      return res.status(201).json({ 
        success: true, 
        data: { ...newApplication, _id: result.insertedId },
        message: 'Application submitted successfully'
      });
    }

    // Track Application
    if (action === 'trackApplication') {
      const { applicationId } = req.body;
      
      const application = await db.collection('applications').findOne({
        $or: [
          { applicationId },
          { _id: new ObjectId(applicationId) }
        ]
      });

      if (!application) {
        return res.status(404).json({ success: false, message: 'Application not found' });
      }

      return res.status(200).json({ success: true, data: application });
    }

    // Get Messages
    if (action === 'getMessages') {
      const messages = await db.collection('messages')
        .find({ userId: new ObjectId(userId) })
        .sort({ createdAt: -1 })
        .toArray();

      return res.status(200).json({ success: true, data: messages });
    }

    // Mark Message as Read
    if (action === 'markMessageRead') {
      const { messageId } = req.body;
      
      await db.collection('messages').updateOne(
        { _id: new ObjectId(messageId), userId: new ObjectId(userId) },
        { $set: { isRead: true } }
      );

      return res.status(200).json({ success: true, message: 'Message marked as read' });
    }

    // Get Documents
    if (action === 'getDocuments') {
      const documents = await db.collection('documents')
        .find({ userId: new ObjectId(userId) })
        .sort({ uploadedAt: -1 })
        .toArray();

      return res.status(200).json({ success: true, data: documents });
    }

    // Submit Support Request
    if (action === 'submitSupport') {
      const { subject, message } = req.body;
      
      const supportTicket = {
        userId: new ObjectId(userId),
        subject,
        message,
        isRead: false,
        type: 'support',
        createdAt: new Date(),
        from: 'user'
      };

      await db.collection('messages').insertOne(supportTicket);

      return res.status(200).json({ 
        success: true, 
        message: 'Support request submitted successfully' 
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid action' });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    if (client) {
      await client.close();
    }
  }
}