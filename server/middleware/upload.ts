import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../../uploads");

// Ensure uploads directory exists
fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIMETYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/rtf": "rtf",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    // A bare Date.now() collides: two uploads of the same type within one
    // millisecond produced an identical path, and diskStorage truncates, so the
    // second write silently overwrote the first user's bytes while both
    // Attachment rows pointed at the same file. A random component makes the
    // name collision-proof and non-enumerable.
    const ext = ALLOWED_MIMETYPES[file.mimetype] || path.extname(file.originalname).slice(1);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`);
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
      ".pptx": "pptx",
      ".txt": "txt",
      ".csv": "csv",
      ".rtf": "rtf",
      ".odt": "odt",
      ".zip": "zip",
    };
    if (ALLOWED_EXTENSIONS[ext]) {
      cb(null, true);
    } else {
      const err = new Error("Only PDF, DOCX, XLSX, PPTX, TXT, CSV, RTF, ODT, and ZIP files are allowed");
      (err as any).statusCode = 400;
      (err as any).expose = true;
      cb(err);
    }
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

export default upload;
