import { v2 as cloudinary } from 'cloudinary';
import { MongoClient, ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import formidable from 'formidable';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET;

export const config = {
  api: {
    bodyParser: false,
  },
};

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }
  
  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, jwtSecret);
  return decoded;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const decoded = verifyToken(req);
    const userId = decoded.userId;

    // Parse form data
    const form = formidable({
      maxFileSize: 5 * 1024 * 1024, // 5MB limit
      allowEmptyFiles: false,
    });

    const [fields, files] = await form.parse(req);
    const file = files.file?.[0];
    const category = fields.category?.[0] || 'general';

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(file.filepath, {
      folder: 'legitcar/documents',
      resource_type: 'auto',
      public_id: `${userId}_${Date.now()}`,
    });

    // Save to database
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('legitcar');

    const document = {
      userId: new ObjectId(userId),
      fileName: uploadResult.public_id,
      originalName: file.originalFilename,
      fileUrl: uploadResult.secure_url,
      fileType: file.mimetype,
      fileSize: file.size,
      category,
      uploadedAt: new Date(),
    };

    const result = await db.collection('documents').insertOne(document);
    await client.close();

    return res.status(200).json({
      success: true,
      data: { ...document, _id: result.insertedId },
      message: 'File uploaded successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ success: false, message: 'Upload failed' });
  }
}