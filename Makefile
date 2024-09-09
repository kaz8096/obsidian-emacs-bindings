TARGET_DIR_PATH = ${OBSIDIAN_PLUGINS_DIR}/obsidian-emacs-bindings

lint:
	yarn lint
	yarn lint:fix

build: lint
	yarn install
	yarn build

install: build
	mkdir -p ${TARGET_DIR_PATH}
	cp main.js styles.css manifest.json ${TARGET_DIR_PATH}

uninstall:
	rm -rf ${TARGET_DIR_PATH}
