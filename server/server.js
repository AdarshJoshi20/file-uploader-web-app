// server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const sanitize = require('sanitize-filename');

const app = express();
const PORT = 3001;

const MAX_NAME_LEN = 200;
const uploadsDir = path.join(__dirname, 'uploads');

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize SQLite database
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Create documents table (includes original_filename for new DBs)
function initializeDatabase() {
  db.run(
    `
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_filename TEXT,
      filepath TEXT NOT NULL,
      filesize INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) {
        console.error('Error creating table:', err);
      } else {
        console.log('Documents table ready');
      }
    }
  );
}

/**
 * Quick magic-byte check to validate a real PDF.
 * Reads first 4 bytes and checks for "%PDF".
 * Returns true if matches, false otherwise.
 */
function isRealPDF(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return buf.toString() === '%PDF';
  } catch (err) {
    console.error('PDF magic-byte check failed:', err);
    return false;
  }
}

// Configure multer for file upload with sanitized filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    let original = file.originalname || 'file';

    // Normalize Unicode (NFC if supported), remove control chars, and trim
    original = original.normalize ? original.normalize('NFC') : original;
    original = original.replace(/[\x00-\x1F\x7F]/g, '').trim();

    // Sanitize and collapse whitespace, limit length
    let safeOriginal = sanitize(original).replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LEN);

    // Fallback name when sanitize strips everything
    if (!safeOriginal) safeOriginal = 'file.pdf';

    // Ensure extension ends with .pdf for stored filename readability
    if (!/\.pdf$/i.test(safeOriginal)) safeOriginal = safeOriginal + '.pdf';

    // Remove any leading dots/spaces to avoid hidden file issues
    safeOriginal = safeOriginal.replace(/^[.\s]+/, '');

    // Create unique prefix and final stored filename
    const uniquePrefix = `${Date.now()}-${Math.floor(Math.random() * 1e9).toString(16)}`;
    const storedName = `${uniquePrefix}-${safeOriginal}`;

    // Attach the original (normalized, un-sanitized) name to the request for DB insert
    req.savedOriginalFilename = original;

    cb(null, storedName);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Quick check: allow only PDFs by mimetype (browser-provided). Real check later.
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed (mimetype check)'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// API Routes

// 1. Upload a PDF document
app.post('/api/documents/upload', upload.single('document'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { filename, path: filepath, size } = req.file;
  const originalFilename = req.savedOriginalFilename || filename;

  // Do a magic-byte check to ensure the uploaded file is actually a PDF.
  if (!isRealPDF(filepath)) {
    // Delete the uploaded file immediately if not a real PDF
    try {
      fs.unlinkSync(filepath);
    } catch (e) {
      console.error('Failed to remove non-PDF file:', e);
    }
    return res.status(400).json({ error: 'Uploaded file is not a valid PDF' });
  }

  // Try to insert with original_filename column. If the column doesn't exist (older DB),
  // fall back to inserting without it.
  db.run(
    'INSERT INTO documents (filename, original_filename, filepath, filesize) VALUES (?, ?, ?, ?)',
    [filename, originalFilename, filepath, size],
    function (err) {
      if (err) {
        // If column original_filename doesn't exist, fallback to older insert signature
        if (err.message && err.message.includes('no such column: original_filename')) {
          db.run(
            'INSERT INTO documents (filename, filepath, filesize) VALUES (?, ?, ?)',
            [filename, filepath, size],
            function (err2) {
              if (err2) {
                // Delete uploaded file if database insert fails
                try {
                  fs.unlinkSync(filepath);
                } catch (e) { /* ignore */ }
                return res.status(500).json({ error: 'Database error: ' + err2.message });
              }

              return res.status(201).json({
                id: this.lastID,
                filename,
                filesize: size,
                message: 'File uploaded successfully (original_filename column not present)',
              });
            }
          );
          return;
        }

        // Generic DB error
        try {
          fs.unlinkSync(filepath);
        } catch (e) { /* ignore */ }
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }

      return res.status(201).json({
        id: this.lastID,
        filename,
        original_filename: originalFilename,
        filesize: size,
        message: 'File uploaded successfully',
      });
    }
  );
});

// 2. Get all documents
app.get('/api/documents', (req, res) => {
  db.all('SELECT * FROM documents ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }
    res.json(rows);
  });
});

// 3. Download a specific document
app.get('/api/documents/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM documents WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }

    if (!row) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filePath = row.filepath;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Prefer original filename for download if available
    const downloadName = row.original_filename || row.filename;

    res.download(filePath, downloadName, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error downloading file' });
        }
      }
    });
  });
});

// 4. Delete a document
app.delete('/api/documents/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM documents WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }

    if (!row) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete file from filesystem
    const filePath = row.filepath;
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
    }

    // Delete record from database
    db.run('DELETE FROM documents WHERE id = ?', [id], (err2) => {
      if (err2) {
        return res.status(500).json({ error: 'Database error: ' + err2.message });
      }

      res.json({ message: 'Document deleted successfully' });
    });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 10MB limit' });
    }
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});
