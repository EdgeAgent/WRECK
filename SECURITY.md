# Security policy

Please do not report exploitable vulnerabilities in public issues. Use GitHub’s private vulnerability reporting for the WRECK repository where available, or contact the repository maintainers through the private channel shown on the GitHub profile.

WRECK’s CLI does not fetch or execute the target URL. It accepts only HTTP(S) URLs as project metadata and copies the bundled cloner template. Never put target credentials, cookies, API keys, or personal data in `wreck.config.json`, SPEC files, logs, screenshots, or source control.

For vulnerabilities in the included REA or AI Website Cloner source, follow the security instructions in the respective upstream repository as well as WRECK’s own reporting path.
