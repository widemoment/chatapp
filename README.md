# chatapp
## Requirements
- Node.js 18+
- PostgreSQL 14+ (or any recent version)
- A database created for the app
### 1) Install dependencies
```bash
npm install
createdb chatapp
export DATABASE_URL="postgres://$(whoami)@localhost:5432/chatapp"
export OWNER_EMAIL="your_email@example.com"
export MOD_EMAILS="mod1@example.com,mod2@example.com"
node server.js
