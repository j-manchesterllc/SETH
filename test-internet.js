const https = require('https');

https.get('https://www.google.com', (res) => {
  console.log('Status code:', res.statusCode);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
}).on('error', (e) => {
  console.error('Error:', e.message);
});