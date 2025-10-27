import Student from "../models/Student.js";
import stream from "stream";
import { pipeline } from "stream/promises";
import archiver from "archiver";
import axios from "axios";
import cloudinary from "../utils/cloudinary.js";

// Delete student and their passport from Cloudinary
export async function deleteStudent(req, res) {
  try {
    const { id } = req.params;
    const student = await Student.findById(id);

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    // Extract public_id from Cloudinary URL
    const publicId = student.passport.split("/").slice(-1)[0].split(".")[0];

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
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
}

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

// OPTIMIZED: Batch download passports with parallel processing and better error handling
export async function batchDownloadPassports(req, res) {
  let archive = null;
  let keepAliveInterval = null;
  let isAborted = false;

  try {
    const { department, level } = req.query;
    if (!department && !level) {
      return res
        .status(400)
        .json({ success: false, message: "Department or level is required" });
    }

    // Build filter
    const filter = {};
    if (department) filter.department = department;
    if (level) filter.level = level;

    const students = (await Student.find(filter)) || [];
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No students found",
      });
    }

    console.log(`Starting batch download for ${students.length} students`);

    // Setup response headers
    const filename = [
      department && `${department}`,
      level && `${level}L`,
      "passports",
    ]
      .filter(Boolean)
      .join("_");

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}.zip"`
    );
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    // Critical: Disable all timeouts
    req.setTimeout(0);
    res.setTimeout(0);
    if (req.socket) {
      req.socket.setTimeout(0);
      req.socket.setNoDelay(true);
      req.socket.setKeepAlive(true, 30000);
    }

    // Keep connection alive with periodic writes
    keepAliveInterval = setInterval(() => {
      if (!isAborted && res.writable) {
        res.write(Buffer.alloc(0));
      }
    }, 10000); // Every 10 seconds

    // Handle client disconnect
    const handleAbort = () => {
      if (!isAborted) {
        isAborted = true;
        console.log("Client disconnected, aborting download");
        if (keepAliveInterval) clearInterval(keepAliveInterval);
        if (archive) {
          try {
            archive.abort();
          } catch (e) {
            console.error("Error aborting archive:", e);
          }
        }
      }
    };

    res.on("close", handleAbort);
    res.on("error", handleAbort);
    req.on("aborted", handleAbort);

    // Create archive with STORE mode (no compression)
    archive = archiver("zip", {
      zlib: { level: 0 }, // No compression for speed
      store: true,
    });

    let archiveFinalized = false;

    archive.on("error", (err) => {
      console.error("Archive error:", err);
      handleAbort();
    });

    archive.on("warning", (err) => {
      console.warn("Archive warning:", err);
    });

    archive.on("finish", () => {
      archiveFinalized = true;
      console.log("Archive finished");
    });

    // Pipe archive to response
    archive.pipe(res);

    // Optimized axios instance
    const axiosInstance = axios.create({
      timeout: 20000, // 20 seconds per image
      maxRedirects: 3,
      responseType: "stream",
      maxContentLength: 20 * 1024 * 1024, // 20MB max
      decompress: false, // Don't decompress, save CPU
      headers: {
        "Accept-Encoding": "identity", // No compression
      },
    });

    // Download and add image to archive
    const processImage = async (student) => {
      if (isAborted) return { success: false, skipped: true };

      if (!student.passport || !student.matricNumber) {
        console.warn(
          `Missing data for student: ${student.matricNumber || "unknown"}`
        );
        return { success: false, reason: "missing_data" };
      }

      const url = student.passport;
      const ext = url.match(/\.(jpg|jpeg|png|gif|webp)$/i)?.[0] || ".jpg";
      const filename = `${student.matricNumber}${ext}`;

      try {
        // Fetch image with timeout
        const response = await axiosInstance.get(url);

        // Use pipeline for better stream handling
        await new Promise((resolve, reject) => {
          const passThrough = new stream.PassThrough();
          let completed = false;

          const timeout = setTimeout(() => {
            if (!completed) {
              completed = true;
              passThrough.destroy(new Error("Stream timeout"));
              reject(new Error(`Timeout for ${filename}`));
            }
          }, 15000); // 15 second stream timeout

          const cleanup = () => {
            if (!completed) {
              completed = true;
              clearTimeout(timeout);
            }
          };

          passThrough.once("error", (err) => {
            cleanup();
            reject(err);
          });

          passThrough.once("finish", () => {
            cleanup();
            resolve();
          });

          response.data.once("error", (err) => {
            cleanup();
            passThrough.destroy(err);
          });

          // Add to archive BEFORE piping
          archive.append(passThrough, { name: filename });

          // Now pipe the data
          response.data.pipe(passThrough);
        });

        return { success: true, filename };
      } catch (error) {
        console.error(
          `Failed to process ${student.matricNumber}:`,
          error.message
        );
        return { success: false, reason: error.message };
      }
    };

    // Process images in PARALLEL batches for speed
    const BATCH_SIZE = 5; // Process 5 images simultaneously
    const results = { success: 0, failed: 0, skipped: 0 };

    for (let i = 0; i < students.length; i += BATCH_SIZE) {
      if (isAborted) break;

      const batch = students.slice(i, i + BATCH_SIZE);
      console.log(
        `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: students ${
          i + 1
        }-${Math.min(i + BATCH_SIZE, students.length)}`
      );

      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map((student) => processImage(student))
      );

      // Count results
      batchResults.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          if (result.value.success) {
            results.success++;
            console.log(`✓ ${batch[idx].matricNumber}`);
          } else if (result.value.skipped) {
            results.skipped++;
          } else {
            results.failed++;
            console.log(`✗ ${batch[idx].matricNumber}`);
          }
        } else {
          results.failed++;
          console.log(`✗ ${batch[idx].matricNumber}: ${result.reason}`);
        }
      });

      // Small delay between batches to prevent overwhelming
      if (i + BATCH_SIZE < students.length && !isAborted) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    console.log(
      `Results: ${results.success} success, ${results.failed} failed, ${results.skipped} skipped`
    );

    // Finalize the archive
    if (!isAborted && !archiveFinalized) {
      console.log("Finalizing archive...");
      await archive.finalize();
      console.log("Archive finalized successfully");
    }
  } catch (error) {
    console.error("Batch download error:", error);
    isAborted = true;

    if (keepAliveInterval) clearInterval(keepAliveInterval);
    if (archive && !res.headersSent) {
      try {
        archive.abort();
      } catch (e) {
        console.error("Error aborting archive:", e);
      }
    }

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Server error during batch download",
        error: error.message,
      });
    }
  } finally {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
  }
}
