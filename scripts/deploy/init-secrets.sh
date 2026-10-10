#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
    printf 'Run this script with sudo so secrets can be owned by Reedito container UID 1000.\n' >&2
    exit 1
fi

umask 077
secret_dir="${REEDITO_SECRET_DIR:-./secrets}"
mkdir -p "$secret_dir"
chmod 700 "$secret_dir"

write_random_secret() {
    name="$1"
    file="$secret_dir/$name"
    if [[ ! -s "$file" ]]; then
        openssl rand -hex 32 > "$file"
        chmod 600 "$file"
        printf 'Generated %s\n' "$file"
    else
        printf 'Keeping existing %s\n' "$file"
    fi
}

write_prompted_secret() {
    name="$1"
    prompt="$2"
    file="$secret_dir/$name"
    if [[ -s "$file" ]]; then
        printf 'Keeping existing %s\n' "$file"
        return
    fi

    printf '%s: ' "$prompt" >&2
    IFS= read -r -s value
    printf '\n' >&2
    if [[ -z "$value" ]]; then
        printf 'A non-empty value is required for %s.\n' "$name" >&2
        exit 1
    fi
    printf '%s' "$value" > "$file"
    chmod 600 "$file"
}

write_random_secret mysql_root_password
write_random_secret mysql_app_password
write_random_secret restic_password
write_prompted_secret resend_smtp_password 'Resend SMTP API key'
write_prompted_secret mailgun_api_key 'Mailgun API key'

for name in mysql_root_password mysql_app_password restic_password resend_smtp_password mailgun_api_key; do
    chown 1000:1000 "$secret_dir/$name"
    chmod 400 "$secret_dir/$name"
done

printf '\nSecrets created in %s. Keep this directory private and backed up securely.\n' "$secret_dir"
