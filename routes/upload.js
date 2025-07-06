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

// POST /api/v1/upload/document - Upload document (placeholder)
router.post('/document', verifyToken, async (req, res) => {
    try {
        // This is a placeholder for file upload functionality
        // You'll need to implement actual file upload logic with multer/cloudinary
        
        const db = getDB();
        const userId = req.user.userId;
        
        // Placeholder document entry
        const document = {
            userId: new ObjectId(userId),
            fileName: 'placeholder.pdf',
            originalName: 'document.pdf',
            uploadDate: new Date().toISOString(),
            fileSize: 0,
            mimeType: 'application/pdf'
        };
        
        const result = await db.collection('documents').insertOne(document);
        
        res.json({
            success: true,
            message: 'Document uploaded successfully (placeholder)',
            documentId: result.insertedId
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Upload failed'
        });
    }
});

export default router;
