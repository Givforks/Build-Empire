Place runtime secret values here before production compose deployment.

Required files:
- jwt_secret.txt
- admin_password.txt
- smtp_password.txt

Example commands:

printf '%s' 'replace-with-strong-jwt-secret' > secrets/jwt_secret.txt
printf '%s' 'replace-with-admin-password' > secrets/admin_password.txt
printf '%s' 'replace-with-smtp-password' > secrets/smtp_password.txt

Do not commit these files.
