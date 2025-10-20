import Student from "../models/Student.js";
import stream from "stream";
import archiver from "archiver";
import axios from "axios";
import cloudinary from "../utils/cloudinary.js";

// Delete student and their passport from Cloudinary
export async function deleteStudent(req, res) {
  try {
    const { id } = req.params;
    const student = await Student.findById(id);
    
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    // Extract public_id from Cloudinary URL
    const publicId = student.passport.split('/').slice(-1)[0].split('.')[0];
    
    // Delete image from Cloudinary
    try {
      await cloudinary.uploader.destroy(`passports/${publicId}`);
    } catch (cloudinaryError) {
      console.error("Cloudinary delete error:", cloudinaryError);
      // Continue with student deletion even if Cloudinary delete fails
    }

    // Delete student from database
    await Student.findByIdAndDelete(id);

    res.json({ success: true, message: "Student deleted successfully" });
  } catch (error) {
    console.error("Delete student error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
}

// Get all students

// Get all students, optionally filter by department and level
export async function getAllStudents(req, res) {
  try {
    const { department, level } = req.query;
    const filter = {};
    
    // Add filters only if they are provided
    if (department) filter.department = department;
    if (level) filter.level = level;
    
    const students = await Student.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, students });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
}

// Download passport image
// Download passport image (Cloudinary: just return the URL or 405)
export async function downloadPassport(req, res) {
  try {
    const { id } = req.params;
    const student = await Student.findById(id);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }
    // For Cloudinary, just return the URL (frontend should use it directly)
    return res.status(405).json({
      success: false,
      message: "Direct download not supported. Use the Cloudinary URL.",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
}

// Batch download passports by department as zip (Cloudinary: fetch, zip, stream)
export async function batchDownloadPassports(req, res) {
  try {
    const { department, level } = req.query;
    if (!department && !level) {
      return res
        .status(400)
        .json({ success: false, message: "Department or level is required" });
    }
    
    // Build filter based on provided parameters
    const filter = {};
    if (department) filter.department = department;
    if (level) filter.level = level;
    
    const students = (await Student.find(filter)) || [];
    if (!Array.isArray(students) || students.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No students found for this department",
        });
    }
    res.setHeader("Content-Type", "application/zip");
    const filename = [
      department && `${department}`,
      level && `${level}L`,
      'passports'
    ].filter(Boolean).join('_');
    
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"${filename}.zip\"`
    );
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("Archiver error:", err);
      if (!res.headersSent) res.status(500).end();
    });
    archive.pipe(res);

    // Process images in chunks to avoid memory issues
    const chunkSize = 5; // Process 5 images at a time
    const chunks = [];
    for (let i = 0; i < students.length; i += chunkSize) {
      chunks.push(students.slice(i, i + chunkSize));
    }

    // Helper to stream a single image from Cloudinary into the zip
    const addImageToArchive = async (student) => {
      if (!student.passport) return;
      
      try {
        const url = student.passport;
        const ext = (() => {
          try {
            return (new URL(url).pathname.match(/\.[a-zA-Z0-9]+$/) || [".jpg"])[0];
          } catch {
            return ".jpg";
          }
        })();
        const filename = `${student.matricNumber}${ext}`;
        
        const response = await axios.get(url, { 
          responseType: "stream",
          timeout: 5000 // 5 second timeout per image
        });
        
        return new Promise((resolve, reject) => {
          const pass = new stream.PassThrough();
          response.data.pipe(pass);
          archive.append(pass, { name: filename });
          
          const timer = setTimeout(() => {
            reject(new Error(`Timeout downloading ${filename}`));
          }, 5000);
          
          pass.on("end", () => {
            clearTimeout(timer);
            resolve();
          });
          
          pass.on("error", (err) => {
            clearTimeout(timer);
            console.error(`Error processing ${filename}:`, err);
            resolve(); // Continue with other images even if one fails
          });
        });
      } catch (err) {
        console.error(
          `Failed to fetch image for ${student.matricNumber}:`,
          err.message
        );
        // Continue with other images
      }
    };

    // Process chunks sequentially to manage memory
    for (const chunk of chunks) {
      await Promise.all(chunk.map(addImageToArchive));
    }

    archive.finalize();
    
    // Set a timeout to abort if it takes too long
    setTimeout(() => {
      if (!res.writableEnded) {
        res.status(408).json({
          success: false,
          message: "Download timeout. Please try with fewer images or try again.",
        });
      }
    }, 25000); // 25 second overall timeout
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
}
