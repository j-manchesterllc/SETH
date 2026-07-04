const https = require('https');

https.get('https://db.zaoroijuvdykeqayymnp.supabase.co', (res) => {
  console.log('Status code:', res.statusCode);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
}).on('error', (e) => {
  console.error('Error:', e.message);
});