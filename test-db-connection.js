#!/usr/bin/env node
// Database connection test script
// This script tests connectivity to the Supabase database
// Note: Will fail in current environment due to IPv6 connectivity issue
// but demonstrates the correct connection approach

const { Client } = require('pg');

// Connection string from environment (would normally come from process.env.DATABASE_URL)
const connectionString = "postgresql://postgres:***@db.zaoroijuvdykeqayymnp.supabase.co:5432/postgres";

console.log('Testing database connection...');
console.log('Connecting to:', connectionString.replace(/:[^:@]+@/, ':***@')); // Hide password in log

const client = new Client({
  connectionString: connectionString,
});

async function testConnection() {
  try {
    await client.connect();
    console.log('✅ Successfully connected to PostgreSQL database!');
    
    // Test version
    const versionResult = await client.query('SELECT version()');
    console.log('PostgreSQL version:', versionResult.rows[0].version);
    
    // Test if our tables exist (after schema is applied)
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`\nFound ${tablesResult.rowCount} tables in public schema:`);
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    await client.end();
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:');
    console.error('   Message:', err.message);
    console.error('   Code:', err.code);
    
    // Provide helpful diagnosis
    if (err.code === 'ENOTFOUND' || err.code === 'ENETUNREACH') {
      console.error('\n💡 Diagnosis: Network connectivity issue');
      console.error('   The Supabase host is IPv6-only but this environment has limited IPv6 connectivity.');
      console.error('   This is an environmental limitation, not a configuration problem.');
      console.error('\n🔧 Solutions:');
      console.error('   1. Use Supabase SQL Editor to run database_schema.sql');
      console.error('   2. Deploy via Vercel/Abacus.ai (they handle DB connections in their network)');
      console.error('   3. Wait for IPv6 connectivity to be restored in this environment');
    } else if (err.code === '28P01') {
      console.error('\n💡 Diagnosis: Authentication failed');
      console.error('   Check your database credentials in .env file');
    }
    
    try {
      await client.end();
    } catch (e) { /* Ignore */ }
    
    return false;
  }
}

// Run the test
testConnection().then(success => {
  process.exit(success ? 0 : 1);
});