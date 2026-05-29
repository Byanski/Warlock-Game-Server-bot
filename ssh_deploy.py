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
    commands = "cd ~/warlockbot/Warlock-Game-Server-bot && docker-compose logs --tail=20"
    run_ssh_command("10.10.1.16", "llm", "password", commands)
