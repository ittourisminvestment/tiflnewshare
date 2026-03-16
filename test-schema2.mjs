import https from 'https';

const url = 'eykgtrxqtpteamzkovzy.supabase.co';
const path = '/rest/v1/company_settings?select=*';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5a2d0cnhxdHB0ZWFtemtvdnp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDQxMjMsImV4cCI6MjA4ODc4MDEyM30.XNkSZFL_a-_F5yr1lT-r3oLEZWUxekr2a8YO6hkpBWo';

const options = {
  hostname: url,
  path: path,
  method: 'GET',
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (d) => { data += d; });
  res.on('end', () => {
    console.log("STATUS:", res.statusCode);
    console.log("DATA:", data);
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.end();
