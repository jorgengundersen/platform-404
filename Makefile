DATA_DIR := .data
OPENCODE_DB := $(DATA_DIR)/opencode.dev.db
DASHBOARD_DB := $(DATA_DIR)/dashboard.dev.db

.PHONY: dev dev-db clean-dev-db

dev: dev-db
	OPENCODE_DB_PATH="$(OPENCODE_DB)" \
	DASHBOARD_DB_PATH="$(DASHBOARD_DB)" \
	bun run dev

dev-db:
	mkdir -p "$(DATA_DIR)"
	bun run scripts/seed-dev-opencode-db.ts "$(OPENCODE_DB)"

clean-dev-db:
	rm -rf "$(DATA_DIR)"
