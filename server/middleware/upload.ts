import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../../uploads");

// Ensure uploads directory exists
fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIMETYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const ext = ALLOWED_MIMETYPES[file.mimetype] || path.extname(file.originalname).slice(1);
    cb(null, `${timestamp}.${ext}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (ALLOWED_MIMETYPES[file.mimetype]) {
    cb(null, true);
  } else {
    // Fallback: check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    const ALLOWED_EXTENSIONS: Record<string, string> = {
      ".pdf": "pdf",
      ".docx": "docx",
      ".xlsx": "xlsx",
      ".zip": "zip",
    };
    if (ALLOWED_EXTENSIONS[ext]) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, XLSX, and ZIP files are allowed"));
    }
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

export default upload;
