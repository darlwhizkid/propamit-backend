import express from 'express';
import { getDB } from '../db/connectDB.js';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

const router = express.Router();
const jwtSecret = process.env.JWT_SECRET;

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// GET /api/v1/user/data - Get user dashboard data
router.get('/data', verifyToken, async (req, res) => {
    try {
        const db = getDB();
        const userId = req.user.userId;
        
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
        return res.json({
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
        console.error('User data error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;
