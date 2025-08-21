import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import { createStudent } from "../controllers/uploadController.js";

const router = express.Router();

// POST /api/students
router.post("/students", upload.single("passport"), createStudent);

export default router;
