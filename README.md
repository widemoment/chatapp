# chatapp
## Requirements
- Node.js 18+
- PostgreSQL 14+ (or any recent version)
- A database created for the app
### 1) Install dependencies
```bash
npm install
```
### 2) Create db
```bash
createdb chatapp
```
### 3) Set environment variables
```bash
export DATABASE_URL="postgres://$(whoami)@localhost:5432/chatapp"
export OWNER_EMAIL="your_email@example.com"
export MOD_EMAILS="mod1@example.com,mod2@example.com"
```
### 4) Start the server
```bash
node server.js
```
