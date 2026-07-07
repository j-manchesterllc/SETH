const { Client } = require('pg');

const config = {
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.zaoroijuvdykeqayymnp',
  password: 'lyyew59eNhJyczO3',
  ssl: {
    rejectUnauthorized: false,
    // Try to set SNI hostname
    servername: 'zaoroijuvdykeqayymnp'
  }
};

const client = new Client(config);

client.connect()
  .then(() => client.query('SELECT version();'))
  .then(res => {
    console.log('Success:', res.rows[0]);
    client.end();
  })
  .catch(err => {
    console.error('Error:', err.message);
    client.end();
  });
