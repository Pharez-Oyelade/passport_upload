import Student from "../models/Student.js";
import cloudinary from "../utils/cloudinary.js";
import fs from "fs";

export async function createStudent(req, res) {
  try {
    const { department, matricNumber } = req.body;
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "Passport is required" });
    }
    if (!department || !matricNumber) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "passports",
      public_id: `${matricNumber}_${Date.now()}`,
      resource_type: "image",
    });
    // Remove local file after upload
    fs.unlinkSync(req.file.path);
    const student = new Student({
      department,
      matricNumber,
      passport: result.secure_url, // Store Cloudinary URL
    });
    await student.save();
    res
      .status(201)
      .json({ success: true, message: "Student uploaded successfully" });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ success: false, message: "Matric number already exists" });
    }
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
}
