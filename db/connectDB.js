import { MongoClient } from 'mongodb';

let db = null;
let client = null;

export const connectDB = async () => {
    try {
        if (db) {
            console.log('📦 Using existing database connection');
            return db;
        }

        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI environment variable is not defined');
        }

        client = new MongoClient(uri);
        await client.connect();
        
        db = client.db('propamit');
        console.log('✅ Connected to MongoDB database: propamit');
        
        return db;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
};

export const getDB = () => {
    if (!db) {
        throw new Error('Database not connected. Call connectDB() first.');
    }
    return db;
};

export const closeDB = async () => {
    if (client) {
        await client.close();
        db = null;
        client = null;
        console.log('📦 Database connection closed');
    }
};

// Handle process termination
process.on('SIGINT', async () => {
    await closeDB();
    process.exit(0);
});
