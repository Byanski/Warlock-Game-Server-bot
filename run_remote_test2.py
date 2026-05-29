import paramiko

def run_ssh_command(host, user, password, script_content):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, username=user, password=password)
        sftp = client.open_sftp()
        with sftp.file('test_script.js', 'w') as f:
            f.write(script_content)
        sftp.close()
        
        client.exec_command("docker cp test_script.js warlock-bot:/app/test_script.js")
        stdin, stdout, stderr = client.exec_command("docker exec warlock-bot node /app/test_script.js")
        print("STDOUT:", stdout.read().decode("utf-8", "ignore"))
        print("STDERR:", stderr.read().decode("utf-8", "ignore"))
    finally:
        client.close()

script = """
const { File } = require('buffer');
if (!globalThis.File) globalThis.File = File;

const { WarlockClient } = require('/app/dist/api/warlockClient.js');
async function run() {
  const c = new WarlockClient();
  await c.authenticate();
  const res = await c.request('https://warlock.droogle.tech/api/service/b5453ff4-e65e-3975-a9db-3ec4c12cb911/127.0.0.1/windrose-server');
  console.log(await res.text());
}
run();
"""

if __name__ == "__main__":
    run_ssh_command("10.10.1.16", "llm", "password", script)
