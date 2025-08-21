import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema({
  department: { type: String, required: true },
  matricNumber: { type: String, required: true, unique: true },
  passport: { type: String, required: true }, // Cloudinary URL
  createdAt: { type: Date, default: Date.now },
});

const Student = mongoose.model("Student", StudentSchema);
export default Student;
