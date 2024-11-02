# Bitcoin Loader

Bitcoin Loader is a server-side application designed to read data via RPC from a blockchain node and save it into a SQL database (currently supporting SQLite and PostgreSQL).

## Table of Contents

1. [What is Bitcoin Loader and What is It For?](#what-is-bitcoin-loader-and-what-is-it-for)
    - [Key Features](#key-features)
2. [How to Run](#how-to-run)
    - [a) Running from Source via Monorepo](#a-running-from-source-via-monorepo)
    - [b) Creating Your Own Loader with `@easylayer/bitcoin-loader`](#b-creating-your-own-loader-with-easylayerbitcoin-loader)
3. [Examples](#examples)
4. [License](#license)

## What is Bitcoin Loader and What is It For?

The purpose of Bitcoin Loader is to provide a tool that allows loading data from the blockchain and saving it in a SQL database under any structure. If there is a lot of data (e.g., loading the entire mainnet blockchain), it makes sense to use a strategy where data is loaded initially without indexes and relationships. After catching up with the chain head, you can manually build indexes. The goal is a tool that can work with any database schema and maintain real-time reorganization.

### Key Features

- **Self-Hosted Application**: Developers deploy and manage it themselves.
- **Flexible Connectivity**: Works with both your own blockchain node and custom providers like Quicknode.
- **Block Range Flexibility**: Can be started at any blockchain height range and supports real-time mode with automatic blockchain reorganization.
- **Schema Flexibility**: The `@easylayer/bitcoin-loader` package includes the core of the application. Developers need only to describe the database schema, allowing the loader to load blockchain data into the database under this schema.
- **Node.js Powered**: Uses Node.js as the engine (version 18 or higher is important).
- **Example Applications**: Example applications based on the loader are available in the `examples` folder at the root of the `el` repository.

## How to Run

### a) Running from Source via Monorepo

To run the project from source via the monorepository, follow these steps:

1. **Prerequisites**: You will need [Node.js](https://nodejs.org/) v18 or higher.

2. **Clone the `el` Repository**:

    ```bash
    git clone https://github.com/easylayer/el.git
    ```

3. **Navigate to the Project Folder**:

    ```bash
    cd el
    ```

4. **Install Packages**:

    ```bash
    yarn install
    ```

5. **Build All Packages**:

    ```bash
    yarn build:dev
    ```

6. **Find Example Applications**:

    - In the `examples` folder, there are example applications; look for those related to the loader.

7. **Create Your Own `.env` File**:

    - Copy the example `.env` file:

        ```bash
        cp .env.example .env
        ```

    - Update the `.env` file with your blockchain node URL or a Quicknode provider URL.

8. **Database Configuration**:

    - By default, SQLite is used without any configurations.
    - If you need PostgreSQL, specify the environment variables for PostgreSQL in the `.env` file.

9. **Run the Project**:

    - You can run the project either from the specific example folder or from the root folder of the monorepo.

### b) Creating Your Own Loader with `@easylayer/bitcoin-loader`
*Note: Detailed instructions and examples will be provided in future releases.*

