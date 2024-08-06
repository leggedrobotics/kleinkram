# How to Run the Test Suite

Kleinkram comes with various test suites to ensure the quality of the codebase. This document explains how to run the
test suite.

## Running the Test Suite

Currently, we are only testing the API, those test cases are located in the `backend/tests` directory.
You can run the test suite by first starting the application stack in test mode and then running the tests.

```bash
docker compose -f docker-compose.testing.yml up --build [--watch]
```

::: info
This command will start the application stack in test mode and optionally watches for changes in the codebase.
:::

You can then run the tests by executing the following command:

```bash
yarn run test[:verbose]
```

::: info
The `:verbose` flag is optional and will output more information about the test results.
:::

### How do the Tests Work?

Some of the tests directly interact with the database in order to seed the database with test data.
Thus, it is important to run the tests in a separate environment to avoid data corruption in the development or
production environment.

## End-to-End Testing

End-to-end testing is currently not implemented. We are planning to implement end-to-end tests in the future.

::: warning
End-to-end tests are not implemented yet. We are planning to use [Cypress](https://www.cypress.io/) for end-to-end
testing.
:::
