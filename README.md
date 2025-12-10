# Patient PDF Portal  
A secure web application for uploading, downloading, viewing, and managing PDF documents.  
Built with a React + Vite frontend and an Express + Multer + SQLite backend.

## Features

- Upload PDF files up to 10MB  
- Secure filename sanitization to prevent directory traversal and malicious filenames  
- Magic-byte verification to ensure uploaded files are real PDFs  
- View all uploaded documents with metadata  
- Download files with the original filename  
- Delete documents  
- SQLite database for persistent storage  
- Tailwind CSS UI  
- Fully local development setup

## Project Structure

```
file_uploader_project/
│
├── client/                 # React + Vite frontend
│   ├── src/
│   ├── index.html
│   └── package.json
│
├── server/                 # Node.js backend
│   ├── server.js
│   ├── uploads/            # Stored PDF files (ignored in git)
│   ├── database.sqlite     # SQLite DB (ignored in git)
│   └── package.json
│
└── .gitignore
```

## Technologies Used

### Frontend
- React (with Hooks)
- Vite
- Tailwind CSS
- Lucide Icons

### Backend
- Node.js
- Express
- Multer
- SQLite3
- sanitize-filename
- CORS

## Prerequisites

Install the following:

- Node.js (v20.19 or v22.12+ recommended)
- Git
- SQLite (optional for CLI viewing)

## Installation and Setup

Clone the repository:

```
git clone https://github.com/<your-username>/<your-repo>.git
cd file_uploader_project
```

## Frontend Setup (React + Vite)

```
cd client
npm install
npm run dev
```

## Backend Setup (Express + SQLite)

```
cd server
npm install
npm run dev
```

The backend API is available at:

```
http://localhost:3001/api
```

## API Endpoints

### Upload PDF  
```
POST /api/documents/upload
Form field: document (PDF file)
```

### List all documents  
```
GET /api/documents
```

### Download a document  
```
GET /api/documents/:id
```

### Delete a document  
```
DELETE /api/documents/:id
```

## Security Measures

- Sanitizes filenames  
- Normalizes Unicode  
- Prevents path traversal  
- Validates PDF magic bytes  
- Removes suspicious uploads  
- Limits file size  

## Development Notes

- `uploads/` folder created automatically  
- `database.sqlite` auto-created  
- Both ignored by Git via `.gitignore`

## View the Database

Using SQLite CLI:

```
cd server
sqlite3 database.sqlite
```

Inside SQLite:

```
.tables
.schema documents
SELECT * FROM documents;
```

## Build Frontend for Production

```
cd client
npm run build
```

Output stored in:

```
client/dist
```

## License

Add a license such as MIT as needed.
