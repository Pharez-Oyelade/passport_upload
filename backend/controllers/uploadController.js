import Student from "../models/Student.js";
import cloudinary from "../utils/cloudinary.js";

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

    // Upload to Cloudinary using buffer
    const streamifier = await import("streamifier");
    const stream = streamifier.createReadStream(req.file.buffer);
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "passports",
          public_id: `${matricNumber}_${Date.now()}`,
          resource_type: "image",
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return reject(error);
          }
          resolve(result);
        }
      );
      stream.pipe(uploadStream);
    });

    const student = new Student({
      department,
      matricNumber,
      passport: uploadResult.secure_url, // Store Cloudinary URL
    });
    await student.save();
    res
      .status(201)
      .json({ success: true, message: "Student uploaded successfully" });
  } catch (error) {
    console.error("Upload controller error:", error);
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
