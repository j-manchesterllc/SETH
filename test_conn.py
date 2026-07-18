import subprocess

password = 'HEXf9N7Lgv6BlYn6'
# Try session pooler on port 5432
conn_str = f'postgresql://postgres.zaoroijuvdykeqayymnp:***@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require'

result = subprocess.run(['psql', conn_str, '-c', 'SELECT version();'], capture_output=True, text=True)
print('STDOUT:', result.stdout)
print('STDERR:', result.stderr)
print('Return code:', result.returncode)