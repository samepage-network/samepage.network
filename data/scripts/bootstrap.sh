# This is the entrypoint script for an agent. It is responsible for setting up the agent on a fresh machine.
# This file is hosted on SamePage. To run it for a new agent, simply run:
# 
# curl https://samepage.network/scripts/bootstrap.sh | sh
# 

# INSTALL GIT
sudo apt install git-all

# INSTALL GITHUB CLI
# https://github.com/cli/cli/blob/trunk/docs/install_linux.md
sudo mkdir -p -m 755 /etc/apt/keyrings && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
&& sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
&& sudo apt update \
&& sudo apt install gh -y
# Steps to automate:
# ? What account do you want to log into? GitHub.com
# ? What is your preferred protocol for Git operations on this host? HTTPS
# ? Authenticate Git with your GitHub credentials? Yes
# ? How would you like to authenticate GitHub CLI? Paste an authentication token
# ? Paste your authentication token: <token setup during onboarding>

# INSTALL NODE
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
nvm install 20.11.1 # Install whatever version AWS Lambda latest uses

# INSTALL AGENT
curl -o agent.js https://samepage.network/scripts/agent.js

# CREATE WORKSPACE - This is where the agent will perform most of its work
mkdir workspace

# CONFIGURE VELLUM
echo "Please enter your Vellum API key:"
read VELLUM_API_KEY
echo "Please enter the main Vellum Workflow Deployment Name:"
read VELLUM_WORKFLOW_DEPLOYMENT_NAME
echo "export VELLUM_API_KEY=$VELLUM_API_KEY" >> ~/.bashrc
echo "export VELLUM_WORKFLOW_DEPLOYMENT_NAME=$VELLUM_WORKFLOW_DEPLOYMENT_NAME" >> ~/.bashrc
source ~/.bashrc

# RUN AGENT
node agent.js
