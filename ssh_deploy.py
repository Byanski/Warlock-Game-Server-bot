import paramiko

def run_ssh_command(host, user, password, command):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, username=user, password=password)
        stdin, stdout, stderr = client.exec_command(command)
        print(stdout.read().decode())
        print(stderr.read().decode())
    finally:
        client.close()

if __name__ == "__main__":
    commands = "cd ~/warlockbot/Warlock-Game-Server-bot && docker-compose exec -T warlock-bot node -e \"fetch('https://warlock.droogle.tech/login').then(r=>console.log(r.status)).catch(console.error)\""
    run_ssh_command("10.10.1.16", "llm", "password", commands)
