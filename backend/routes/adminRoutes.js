import express from "express";

import {
  getAllStudents,
  downloadPassport,
  batchDownloadPassports,
  deleteStudent,
} from "../controllers/adminController.js";

const router = express.Router();

// GET /api/admin/students
router.get("/students", getAllStudents);

// GET /api/admin/download-batch?department=DepartmentName
router.get("/download-batch", batchDownloadPassports);

// GET /api/admin/download/:id
router.get("/download/:id", downloadPassport);

// DELETE /api/admin/students/:id
router.delete("/students/:id", deleteStudent);

export default router;
