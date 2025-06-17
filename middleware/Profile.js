const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "Images"); // Ensure this directory exists or create it before using
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    "image/webp",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "application/pdf",
    "application/msword", // DOC
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
     "application/vnd.ms-excel", // XLS
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const maxSize = 2 * 1024 * 1024; // 5MB

const uploads = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: maxSize,
  },
}).single('file')

const upload = (req, res, next) => {
  uploads(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File size exceeds the 2MB limit." });
      }
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    next();
  });
};

module.exports = {
  upload
};



