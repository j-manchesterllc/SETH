#!/usr/bin/env node
// Database connection test script
// This script tests connectivity to the Supabase database

const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:***@db.zaoroijuvdykeqayymnp.supabase.co:5432/postgres";

console.log('Testing database connection...');
console.log('Connecting to:', connectionString.replace(/:[^:@]+@/, ':***@'));

const client = new Client({ connectionString });

async function testConnection() {
  try {
    await client.connect();
    console.log('✅ Successfully connected to PostgreSQL database!');

    const versionResult = await client.query('SELECT version()');
    console.log('PostgreSQL version:', versionResult.rows[0].version);

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

    return true;
  } catch (err) {
    console.error('❌ Database connection failed:');
    console.error('   Message:', err.message);
    console.error('   Code:', err.code);

    if (err.code === 'ENOTFOUND' || err.code === 'ENETUNREACH') {
      console.error('\n💡 Network connectivity issue — Supabase host may be IPv6-only in this environment.');
    } else if (err.code === '28P01') {
      console.error('\n💡 Authentication failed — check DATABASE_URL credentials.');
    }

    return false;
  } finally {
    // Always close the connection
    try { await client.end(); } catch (_) {}
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});
