# SETH Database Setup Instructions

## Overview
This document explains how to set up the SETH database in Supabase using the provided SQL schema file.

## Files Provided
- `database_schema.sql` - Complete SQL schema for all SETH tables, indexes, and triggers

## Prerequisites
1. A Supabase project created at [supabase.com](https://supabase.com)
2. The project's database connection string (already configured in `.env` file)
3. Access to the SQL editor in your Supabase dashboard

## Setup Instructions

### Option 1: Using Supabase SQL Editor (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the entire contents of `database_schema.sql`
5. Click **Run** to execute all statements
6. Wait for completion - this will create all tables, indexes, triggers, and functions

### Option 2: Using psql Command Line
If you prefer to use the command line and have the PostgreSQL client installed:

```bash
# Get your connection string from .env file
# Format: postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

psql "your_connection_string_here" -f database_schema.sql
```

### Option 3: Using Prisma (when connectivity is restored)
Once the IPv6 connectivity issue is resolved, you can use Prisma:
```bash
npx prisma db push  # Creates tables based on Prisma schema
# OR
npx prisma migrate dev --name init  # Creates migration files and applies them
```

## Verification
After running the SQL, you can verify the setup by:

1. In Supabase SQL Editor, run:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```
   
2. You should see all SETH tables listed (User, Agent, Memory, Task, etc.)

3. Check that the `update_updated_at_column` function exists:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'update_updated_at_column';
   ```

## Important Notes

### UUID vs CUID
- This schema uses CUID-like strings (12-character base36) for IDs instead of UUIDs
- The default value uses: `substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)`
- This provides good uniqueness while being more compact than UUIDs

### Updated At Triggers
- All tables with an `updatedAt` column have a trigger that automatically sets it to `now()` on updates
- This uses a single `update_updated_at_column()` function shared by all tables

### Indexes
- All foreign keys have indexes automatically
- Additional indexes are created for common query patterns
- Composite indexes are included where beneficial (e.g., UserId + strength for memory queries)

### Special Data Types
- JSON data is stored as TEXT fields (application handles JSON parsing/stringifying)
- Embeddings are stored as TEXT (JSON float arrays)
- Timestamps use PostgreSQL TIMESTAMP type with timezone handling via application

### Security Considerations
- Row Level Security (RLS) is NOT enabled by default in this schema
- For production, consider enabling RLS and creating appropriate policies
- The API key fields are designed to store encrypted values
- Passwords should be hashed before storage (handled by NextAuth)

## Troubleshooting

### Connection Issues
If you get connection errors when trying to run the SQL:
1. Verify your Supabase project is active
2. Check that your IP is allowed in Supabase's network settings
3. Ensure you're using the correct connection string from your `.env` file

### Permission Errors
Make sure you're running the SQL as a superuser or with sufficient privileges:
- The `postgres` user in Supabase has full privileges
- Avoid using roles with limited permissions for schema creation

### Duplicate Object Errors
If you run the script multiple times, you may get "already exists" errors.
- For development, you can drop and recreate: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`
- For production, use migration tools instead of re-running the full schema

## Next Steps After Database Setup

1. **Test Connection**: Verify your application can connect to the database
2. **Create Initial User**: Use the `/signup` endpoint or create a user directly
3. **Run Seed Script** (optional): Populate with initial data if needed
4. **Start Application**: `npm run dev` or deploy to Vercel/Abacus.ai
5. **Verify Functionality**: Test agent creation, memory storage, task management

## Support
If you encounter issues:
- Check Supabase logs for detailed error messages
- Verify the SQL was executed completely (no partial failures)
- Ensure your `.env` file has the correct DATABASE_URL
- The frontend is already working at https://sethassistant.digital

---
*Schema generated from Prisma schema.prisma at [timestamp]*
*Total tables: 22*
*Total indexes: 30+*
*Triggers: 22 (one per table with updatedAt)*