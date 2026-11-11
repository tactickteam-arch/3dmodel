#!/bin/sh
# One-time setup of the catalogue's own server (Ubuntu, fresh). Run as root (sudo sh setup.sh <site user>) from a
# folder holding this file, nginx-site.conf and deploy.sh. Safe to run again.
# It installs nginx, rsync and certbot; lets in only SSH and the web ports; serves /var/www/sangeetha3d with
# nginx-site.conf; and has the site user run deploy.sh every minute, so a push to GitHub main reaches this server
# as it reaches Vercel. Password logins over SSH are left as they are: that is the server owner's call.
# HTTPS, once the subdomain's DNS points here:  sudo certbot --nginx -d <subdomain> --redirect
set -eu
USER_NAME="$1"
HERE=$(cd "$(dirname "$0")" && pwd)

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q nginx rsync certbot python3-certbot-nginx

install -d -o "$USER_NAME" -g "$USER_NAME" -m 755 /var/www/sangeetha3d
install -m 644 "$HERE/nginx-site.conf" /etc/nginx/sites-available/sangeetha3d
ln -sf /etc/nginx/sites-available/sangeetha3d /etc/nginx/sites-enabled/sangeetha3d
rm -f /etc/nginx/sites-enabled/default

install -o "$USER_NAME" -g "$USER_NAME" -m 755 "$HERE/deploy.sh" "/home/$USER_NAME/deploy.sh"
su - "$USER_NAME" -c "./deploy.sh"
line="* * * * * flock -n /tmp/sangeetha3d-deploy.lock \$HOME/deploy.sh >> \$HOME/deploy.log 2>&1"
( crontab -u "$USER_NAME" -l 2>/dev/null | grep -vF deploy.sh || true; echo "$line" ) | crontab -u "$USER_NAME" -

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

nginx -t
systemctl enable --now nginx
systemctl reload nginx
echo "set up: http://$(hostname -I | cut -d' ' -f1)/"
