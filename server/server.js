// server.js
// Express server for handling patient document uploads, downloads, and management
// Uses SQLite for database, Multer for file uploads, and includes security validations

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const sanitize = require('sanitize-filename');

const app = express();
const PORT = 3001;

// Configuration constants
const MAX_NAME_LEN = 200; // Maximum length for sanitized filenames
const uploadsDir = path.join(__dirname, 'uploads'); // Directory for storing uploaded files

// ===========================
// Middleware Configuration
// ===========================

app.use(cors()); // Enable Cross-Origin Resource Sharing for frontend communication
app.use(express.json()); // Parse JSON request bodies

// ===========================
// File System Setup
// ===========================

// Create uploads directory if it doesn't exist
// This ensures the server can store files even on first run
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ===========================
// Database Initialization
// ===========================

// Initialize SQLite database connection
// Creates a file-based database (database.sqlite) if it doesn't exist
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

/**
 * Creates the documents table if it doesn't exist
 * 
 * Table schema:
 * - id: Auto-incrementing primary key
 * - filename: Sanitized filename stored on disk (unique with timestamp prefix)
 * - original_filename: User's original filename (for display/download)
 * - filepath: Full path to file on server
 * - filesize: File size in bytes
 * - created_at: Timestamp of upload
 */
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

// ===========================
// Security Validation Functions
// ===========================

/**
 * Validates that a file is actually a PDF by checking magic bytes
 * 
 * PDFs start with "%PDF" in their first 4 bytes. This prevents users from
 * uploading malicious files renamed with .pdf extension.
 * 
 * @param {string} filePath - Path to the file to validate
 * @returns {boolean} True if file starts with PDF magic bytes, false otherwise
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

// ===========================
// Multer Configuration
// ===========================

/**
 * Configure Multer storage engine
 * Handles filename sanitization and storage location
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    let original = file.originalname || 'file';

    // Step 1: Normalize Unicode characters (e.g., accented characters)
    // Ensures consistent representation of characters across systems
    original = original.normalize ? original.normalize('NFC') : original;
    
    // Step 2: Remove control characters (invisible/non-printable characters)
    // Prevents issues with special characters that could cause problems
    original = original.replace(/[\x00-\x1F\x7F]/g, '').trim();

    // Step 3: Sanitize filename to remove dangerous characters
    // Collapses multiple spaces and limits length
    let safeOriginal = sanitize(original).replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LEN);

    // Step 4: Provide fallback if sanitization removes everything
    if (!safeOriginal) safeOriginal = 'file.pdf';

    // Step 5: Ensure .pdf extension for consistency
    if (!/\.pdf$/i.test(safeOriginal)) safeOriginal = safeOriginal + '.pdf';

    // Step 6: Remove leading dots/spaces to avoid hidden file issues
    safeOriginal = safeOriginal.replace(/^[.\s]+/, '');

    // Step 7: Create unique filename with timestamp and random hex
    // Prevents filename collisions and provides chronological sorting
    const uniquePrefix = `${Date.now()}-${Math.floor(Math.random() * 1e9).toString(16)}`;
    const storedName = `${uniquePrefix}-${safeOriginal}`;

    // Step 8: Save original filename to request object for database storage
    // This allows us to show users their original filename while storing a safe one
    req.savedOriginalFilename = original;

    cb(null, storedName);
  },
});

/**
 * Configure Multer upload middleware
 * Includes file filtering and size limits
 */
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Initial check: Only allow PDFs based on browser-provided MIME type
    // This is a quick first-pass filter; real validation happens with magic bytes
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed (mimetype check)'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB maximum file size
  },
});

// ===========================
// API Routes
// ===========================

/**
 * POST /api/documents/upload
 * Upload a new PDF document
 * 
 * Request: multipart/form-data with 'document' field containing PDF file
 * Response: JSON with document ID and metadata
 * 
 * Security features:
 * - Filename sanitization
 * - Magic byte validation (real PDF check)
 * - Size limits (10MB)
 * - Automatic cleanup on failure
 */
app.post('/api/documents/upload', upload.single('document'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { filename, path: filepath, size } = req.file;
  const originalFilename = req.savedOriginalFilename || filename;

  // Perform magic-byte validation to ensure file is actually a PDF
  // This catches files that were renamed to .pdf but aren't real PDFs
  if (!isRealPDF(filepath)) {
    // Delete the uploaded file immediately if validation fails
    try {
      fs.unlinkSync(filepath);
    } catch (e) {
      console.error('Failed to remove non-PDF file:', e);
    }
    return res.status(400).json({ error: 'Uploaded file is not a valid PDF' });
  }

  // Insert document record into database
  // Try with original_filename column first (newer schema)
  db.run(
    'INSERT INTO documents (filename, original_filename, filepath, filesize) VALUES (?, ?, ?, ?)',
    [filename, originalFilename, filepath, size],
    function (err) {
      if (err) {
        // Fallback for older database schema without original_filename column
        if (err.message && err.message.includes('no such column: original_filename')) {
          db.run(
            'INSERT INTO documents (filename, filepath, filesize) VALUES (?, ?, ?)',
            [filename, filepath, size],
            function (err2) {
              if (err2) {
                // Clean up uploaded file if database insert fails
                try {
                  fs.unlinkSync(filepath);
                } catch (e) { /* ignore cleanup errors */ }
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

        // Generic database error handling
        try {
          fs.unlinkSync(filepath);
        } catch (e) { /* ignore cleanup errors */ }
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }

      // Success response with new document metadata
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

/**
 * GET /api/documents
 * Retrieve list of all documents
 * 
 * Response: JSON array of document objects ordered by upload date (newest first)
 */
app.get('/api/documents', (req, res) => {
  db.all('SELECT * FROM documents ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }
    res.json(rows);
  });
});

/**
 * GET /api/documents/:id
 * Download a specific document
 * 
 * URL Parameters:
 * - id: Document ID from database
 * 
 * Response: File download with original filename
 * 
 * Features:
 * - Uses original filename for download (user-friendly)
 * - Validates file exists in both database and filesystem
 */
app.get('/api/documents/:id', (req, res) => {
  const { id } = req.params;

  // First, look up document metadata in database
  db.get('SELECT * FROM documents WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }

    if (!row) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filePath = row.filepath;

    // Verify file still exists on filesystem
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Use original filename for download (better user experience)
    // Falls back to stored filename if original isn't available
    const downloadName = row.original_filename || row.filename;

    // Send file as download with appropriate headers
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

/**
 * DELETE /api/documents/:id
 * Delete a document from both database and filesystem
 * 
 * URL Parameters:
 * - id: Document ID to delete
 * 
 * Response: Success message
 * 
 * Features:
 * - Removes file from filesystem
 * - Removes database record
 * - Graceful handling if file already deleted from filesystem
 */
app.delete('/api/documents/:id', (req, res) => {
  const { id } = req.params;

  // Look up document to get filepath
  db.get('SELECT * FROM documents WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }

    if (!row) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete file from filesystem if it exists
    const filePath = row.filepath;
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Error deleting file:', err);
        // Continue to delete database record even if file deletion fails
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

// ===========================
// Error Handling Middleware
// ===========================

/**
 * Global error handler for Express
 * Catches errors from all routes and provides appropriate responses
 * 
 * Special handling for Multer errors (file upload errors)
 */
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Handle Multer-specific errors (file upload issues)
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 10MB limit' });
    }
    return res.status(400).json({ error: err.message });
  }

  // Generic error response
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ===========================
// Server Startup
// ===========================

/**
 * Start the Express server
 */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

// ===========================
// Graceful Shutdown
// ===========================

/**
 * Handle SIGINT (Ctrl+C) for graceful shutdown
 * Closes database connection before exiting
 */
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