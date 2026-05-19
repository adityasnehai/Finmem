.PHONY: install ingest chat dashboard watch eval latency demo test lint clean

install:
	pip install -e ".[dev]"

ingest:
	python scripts/ingest.py

chat:
	python -m finmem.interface.chat chat

dashboard:
	python -m finmem.interface.chat dashboard

watch:
	python -c "from finmem.interface.watch import run_watch; run_watch()"

eval:
	python eval/ablation.py

latency:
	python eval/latency.py

demo:
	python scripts/demo.py

test:
	pytest tests/ -v

lint:
	ruff check finmem/ eval/ scripts/

clean:
	rm -rf finmem_db/ results/*.json __pycache__ .pytest_cache
