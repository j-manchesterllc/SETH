const dns = require('dns');

dns.lookup('db.zaoroijuvdykeqayymnp.supabase.co', (err, address, family) => {
  console.log('Hostname: db.zaoroijuvdykeqayymnp.supabase.co');
  console.log('Address:', address);
  console.log('Family: IPv' + family);
  
  if (err) {
    console.error('DNS lookup error:', err);
  }
});