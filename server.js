import express from 'express';
import { connectDB } from './db/connectDB.js';
import dotenv from "dotenv";
import cors from 'cors';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes from './routes/upload.js';

dotenv.config();
console.log('🔑 JWT_SECRET loaded:', process.env.JWT_SECRET ? 'YES' : 'NO');


const app = express();

// CORS configuration - Allow everything for development
app.use(cors({ 
    origin: true, // Allow all origins
    credentials: true 
}));

app.use(express.json());

// Serve static files from frontend (for testing)
app.use(express.static('../LegitCar-Clean'));

// Health check
app.get("/", (req, res) => {
    res.json({ message: "Propamit API Server Running", status: "OK" });
});

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/upload", uploadRoutes);

const PORT = process.env.PORT || 3000;

// Start server and connect to database ONCE
app.listen(PORT, async () => {
    try {
        await connectDB();
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`✅ Database connected successfully`);
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
});
