FROM devenv:latest
USER root
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
RUN npm install -g @playwright/cli@latest \
	&& ln -sf /opt/node/bin/playwright-cli /usr/local/bin/playwright-cli \
	&& playwright-cli install --skills
RUN apt-get update && npx playwright install --with-deps chromium \
	&& rm -rf /var/lib/apt/lists/*
USER devuser

