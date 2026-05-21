.PHONY: install db-init db-ingest db-update phase2 phase2-detect phase2-embed phase2-index chat dashboard watch eval latency demo test lint clean

install:
	pip install -e ".[dev]"

db-init:
	python scripts/init_db.py

db-ingest:
	python scripts/ingest_market_data.py

db-update:
	python scripts/ingest_market_data.py

phase2:
	cd scripts && python run_phase2.py

phase2-detect:
	python scripts/detect_episodes.py

phase2-embed:
	python scripts/create_embeddings.py

phase2-index:
	python scripts/index_lancedb.py

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
