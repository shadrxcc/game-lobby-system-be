import mongoose from 'mongoose';
import dotenv from "dotenv";
dotenv.config();
 
const connectDB = async () => {
    try {
        const uri: string = process.env.MONGODB_URI
 
        const conn = await mongoose.connect(uri);
 
        console.log(`DB connected ${conn.connection.host}`);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};
 
export default connectDB;