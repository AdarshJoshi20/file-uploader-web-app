Patient Portal - Medical Document Management System
A full-stack web application that allows patients to upload, view, download, and delete their medical documents (PDFs).

🚀 Features
✅ Upload PDF documents with validation
✅ View all uploaded documents with metadata
✅ Download documents
✅ Delete documents
✅ Real-time success/error notifications
✅ Responsive design
✅ File size validation (10MB limit)
✅ PDF-only file type restriction
🛠️ Tech Stack
Frontend
React 18
Lucide React (icons)
Tailwind CSS (styling)
Fetch API (HTTP requests)
Backend
Node.js
Express.js
Multer (file uploads)
SQLite3 (database)
CORS
📋 Prerequisites
Before running this application, make sure you have the following installed:

Node.js (v14 or higher) - Download
npm (comes with Node.js)
🔧 Installation & Setup
1. Clone the Repository
bash
git clone <your-repo-url>
cd patient-portal
2. Backend Setup
bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Required npm packages:
# - express
# - multer
# - cors
# - sqlite3

# Or install manually:
npm install express multer cors sqlite3
Create the backend directory structure:

backend/
├── server.js
├── package.json
├── uploads/          (created automatically)
└── database.sqlite   (created automatically)
3. Frontend Setup
bash
# Navigate to frontend directory (from project root)
cd frontend

# Install dependencies
npm install

# Required packages (if using Create React App):
# - react
# - react-dom
# - lucide-react

# Or install manually:
npm install lucide-react
▶️ Running the Application
Option 1: Run Backend and Frontend Separately
Terminal 1 - Start Backend:

bash
cd backend
node server.js
You should see:

Connected to SQLite database
Documents table ready
Server running on http://localhost:3001
API available at http://localhost:3001/api
Terminal 2 - Start Frontend:

bash
cd frontend
npm start
The application will open in your browser at http://localhost:3000

Option 2: Using package.json scripts
Add to your root package.json:

json
{
  "scripts": {
    "start:backend": "cd backend && node server.js",
    "start:frontend": "cd frontend && npm start",
    "start": "concurrently \"npm run start:backend\" \"npm run start:frontend\""
  }
}
Then run:

bash
npm start
📁 Project Structure
patient-portal/
├── backend/
│   ├── server.js              # Express server and API routes
│   ├── package.json           # Backend dependencies
│   ├── database.sqlite        # SQLite database (auto-generated)
│   └── uploads/               # Uploaded PDF files (auto-generated)
│
├── frontend/
│   ├── src/
│   │   ├── App.js            # Main React component
│   │   └── index.js          # React entry point
│   ├── public/
│   │   └── index.html
│   └── package.json          # Frontend dependencies
│
├── design.md                 # Design document (architecture & decisions)
└── README.md                 # This file
🧪 Testing the API
Using cURL
1. Upload a Document:

bash
curl -X POST http://localhost:3001/api/documents/upload \
  -F "document=@/path/to/your/file.pdf"
2. List All Documents:

bash
curl http://localhost:3001/api/documents
3. Download a Document:

bash
curl http://localhost:3001/api/documents/1 -o downloaded.pdf
4. Delete a Document:

bash
curl -X DELETE http://localhost:3001/api/documents/1
Using Postman
1. Upload Document:

Method: POST
URL: http://localhost:3001/api/documents/upload
Body:
Select "form-data"
Key: document (set type to "File")
Value: Select a PDF file
2. List Documents:

Method: GET
URL: http://localhost:3001/api/documents
3. Download Document:

Method: GET
URL: http://localhost:3001/api/documents/1
Click "Send and Download"
4. Delete Document:

Method: DELETE
URL: http://localhost:3001/api/documents/1
Example API Responses
Upload Success:

json
{
  "id": 1,
  "filename": "1702123456789-987654321-prescription.pdf",
  "filesize": 245678,
  "message": "File uploaded successfully"
}
List Documents:

json
[
  {
    "id": 1,
    "filename": "1702123456789-987654321-prescription.pdf",
    "filepath": "/path/to/uploads/1702123456789-987654321-prescription.pdf",
    "filesize": 245678,
    "created_at": "2024-12-09 14:30:00"
  }
]
Delete Success:

json
{
  "message": "Document deleted successfully"
}
🐛 Troubleshooting
Backend Issues
Port 3001 already in use:

bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or change port in server.js:
const PORT = 3002;
Database errors:

bash
# Delete and recreate database
rm backend/database.sqlite
# Restart server - it will create a new database
Upload directory permission issues:

bash
# Ensure uploads directory is writable
chmod 755 backend/uploads
Frontend Issues
CORS errors:

Ensure backend is running on port 3001
Check CORS is enabled in server.js
Verify API_BASE_URL in frontend matches backend port
Cannot connect to backend:

Confirm backend is running: curl http://localhost:3001/api/documents
Check no firewall blocking port 3001
Verify API_BASE_URL in frontend component
Module not found errors:

bash
cd frontend
rm -rf node_modules package-lock.json
npm install
🔒 Security Notes
This is a development/demo application. For production use, implement:

✅ User authentication (JWT, OAuth)
✅ HTTPS/TLS encryption
✅ Input sanitization
✅ Rate limiting
✅ File virus scanning
✅ HIPAA compliance measures
✅ Audit logging
✅ Cloud storage (S3, Google Cloud Storage)
📝 Database Schema
Table: documents

sql
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,
  filesize INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
🔄 API Endpoints Summary
Endpoint	Method	Description
/api/documents/upload	POST	Upload a PDF document
/api/documents	GET	List all documents
/api/documents/:id	GET	Download a document
/api/documents/:id	DELETE	Delete a document
📊 Features & Validations
Upload Validations
✅ File type must be PDF (application/pdf)
✅ File size must be ≤ 10MB
✅ File is required
✅ Unique filename generation
Error Handling
✅ File type validation
✅ File size validation
✅ Database error handling
✅ File not found handling
✅ User-friendly error messages
🚀 Future Enhancements
 User authentication and authorization
 Document categories (Prescription, Test Results, etc.)
 Search and filter functionality
 PDF preview
 Document sharing with healthcare providers
 Email notifications
 Multi-file upload
 Pagination for large document lists
 Document versioning
 Mobile app
📄 License
This project is created for educational/assessment purposes.

👨‍💻 Author
Full Stack Developer Intern Assessment Project

Quick Start Commands
bash
# Backend
cd backend
npm install
node server.js

# Frontend (new terminal)
cd frontend
npm install
npm start
Application will be available at:

Frontend: http://localhost:3000
Backend API: http://localhost:3001/api
