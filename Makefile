install:
	npm ci

lint:
	npx eslint .

test:
	npm test

test-with-debug:
	DEBUG=nock.* npm test