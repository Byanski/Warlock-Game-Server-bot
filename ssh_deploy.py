import paramiko

def run_ssh_command(host, user, password, command):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, username=user, password=password)
        stdin, stdout, stderr = client.exec_command(command)
        print("STDOUT:", stdout.read().decode("utf-8", "ignore").encode("ascii", "ignore").decode())
    finally:
        client.close()

if __name__ == "__main__":
    commands = "cd ~/warlockbot/Warlock-Game-Server-bot && git pull && sed -i '/WARLOCK_2FA_SECRET/d' .env && docker-compose down && docker-compose up -d --build && sleep 10 && docker-compose logs --tail=40"
    run_ssh_command("10.10.1.16", "llm", "password", commands)
