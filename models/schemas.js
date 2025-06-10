// Database schemas for your dashboard
const userSchema = {
  _id: ObjectId,
  name: String,
  email: String,
  password: String, // hashed
  phone: String,
  isVerified: Boolean,
  createdAt: Date,
  lastLogin: Date,
  profile: {
    avatar: String,
    address: String,
    city: String,
    state: String,
    country: String,
    dateOfBirth: Date,
    gender: String
  }
};

const applicationSchema = {
  _id: ObjectId,
  userId: ObjectId,
  applicationId: String, // APP-123456-789
  type: String, // "vehicle_registration", "document_renewal", etc.
  status: String, // "pending", "processing", "approved", "rejected"
  submittedAt: Date,
  updatedAt: Date,
  data: {
    vehicleInfo: {
      make: String,
      model: String,
      year: Number,
      vin: String,
      color: String
    },
    documents: [String], // Cloudinary URLs
    notes: String
  },
  timeline: [{
    status: String,
    message: String,
    date: Date,
    updatedBy: String
  }]
};

const documentSchema = {
  _id: ObjectId,
  userId: ObjectId,
  fileName: String,
  originalName: String,
  fileUrl: String, // Cloudinary URL
  fileType: String,
  fileSize: Number,
  category: String, // "id", "vehicle_docs", "proof_of_ownership"
  uploadedAt: Date
};

const messageSchema = {
  _id: ObjectId,
  userId: ObjectId,
  subject: String,
  message: String,
  isRead: Boolean,
  type: String, // "system", "support", "notification"
  createdAt: Date,
  from: String // "system" or admin email
};