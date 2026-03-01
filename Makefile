# Makefile for path.ai project

.PHONY: agents.setup agents.run

# ──────────────────────────────────────────────────────────
# agents.setup: Initialize Python virtual environment
# ──────────────────────────────────────────────────────────
agents.setup:
	@command -v python3 >/dev/null 2>&1 || { echo "Python3 not found. Please install Python 3.10+ manually."; exit 1; }
	@cd agents && \
	if [ ! -d venv ]; then \
		echo "Creating virtual environment..."; \
		python3 -m venv venv; \
	fi && \
	echo "Upgrading pip..." && \
	./venv/bin/pip install --upgrade pip && \
	echo "Installing requirements..." && \
	./venv/bin/pip install -r requirements.txt && \
	if [ ! -f .env ]; then \
		echo "Copying .env.example to .env..."; \
		cp .env.example .env; \
	else \
		echo ".env already exists, skipping copy."; \
	fi && \
	echo "✓ Setup complete!"

# ──────────────────────────────────────────────────────────
# agents.run: Start the FastAPI server
# ──────────────────────────────────────────────────────────
agents.run:
	@[ -d agents/venv ] || { echo "Virtual environment not found. Run make agents.setup first."; exit 1; }
	@echo "Starting agents server on http://localhost:8000"
	@cd agents && ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
