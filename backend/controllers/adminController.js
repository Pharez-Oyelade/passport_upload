import Student from "../models/Student.js";

import stream from "stream";
import archiver from "archiver";
import axios from "axios";

// Get all students

// Get all students, optionally filter by department
export async function getAllStudents(req, res) {
  try {
    const { department } = req.query;
    const filter = department ? { department } : {};
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
    const { department } = req.query;
    if (!department) {
      return res
        .status(400)
        .json({ success: false, message: "Department is required" });
    }
    const students = (await Student.find({ department })) || [];
    if (!Array.isArray(students) || students.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No students found for this department",
        });
    }
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"${department}_passports.zip\"`
    );
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("Archiver error:", err);
      if (!res.headersSent) res.status(500).end();
    });
    archive.pipe(res);

    // Helper to stream a single image from Cloudinary into the zip, returns a promise that resolves when the stream ends
    const addImageToArchive = (student) => {
      return new Promise(async (resolve) => {
        if (!student.passport) return resolve();
        try {
          const url = student.passport;
          const ext = (() => {
            try {
              return (new URL(url).pathname.match(/\.[a-zA-Z0-9]+$/) || [
                ".jpg",
              ])[0];
            } catch {
              return ".jpg";
            }
          })();
          const filename = `${student.matricNumber}${ext}`;
          const response = await axios.get(url, { responseType: "stream" });
          const pass = new stream.PassThrough();
          response.data.pipe(pass);
          archive.append(pass, { name: filename });
          response.data.on("end", resolve);
          response.data.on("error", resolve); // resolve even if error, to not hang
        } catch (err) {
          console.error(
            `Failed to fetch image for ${student.matricNumber}:`,
            err.message
          );
          resolve();
        }
      });
    };

    // Wait for all images to be appended before finalizing
    await Promise.all(students.map(addImageToArchive));

    archive.finalize();
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
