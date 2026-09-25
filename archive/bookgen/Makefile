.PHONY: generate compile pipeline pipeline-assets clean

generate:
	python3 bookgen.py

compile:
	python3 bookgen.py --compile-only --output-dir manuscript --overwrite

pipeline:
	python3 bookops.py books/shadows_and_structures.yaml --overwrite

pipeline-assets:
	python3 bookops.py books/shadows_and_structures.yaml --skip-manuscript --overwrite

clean:
	rm -rf manuscript_* 
