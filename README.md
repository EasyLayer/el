EasyLayer provides a suite of ready-to-use self-hosted solutions for blockchain indexing and real-time crypto processing. Our tools are designed to empower developers and businesses to efficiently interact with the blockchains network through robust and scalable applications.

## 🚨 Important

All versions of our applications are currently **experimental**. We **do not recommend** using them in production environments. However, we are actively developing, testing, and improving our products every day to ensure their reliability and performance.

## 📚 Documentation & Website

- **Documentation:** [https://docs.easylayer.io/](https://docs.easylayer.io/)
- **Website:** [https://easylayer.io/](https://easylayer.io/)

## 🔍 Example Applications

In the `examples` folder of the **el** repository, you can find sample applications built using our solutions. These examples demonstrate how to implement and customize our tools to fit various use cases.

## 🛠️ Available Solutions for Bitcoin Network

EasyLayer currently offers four core application concepts for the Bitcoin network:

1. **[Bitcoin Loader (Experimental)](https://github.com/EasyLayer/el/tree/master/packages/bitcoin-loader/README.md)**
   - *Stage:* Experimental Version

2. **[Bitcoin Indexer (Proof of Concept)](https://github.com/EasyLayer/el/tree/master/packages/bitcoin-indexer/README.md)**
   - *Stage:* Proof of Concept

3. **[Bitcoin Listener (Proof of Concept)](https://github.com/EasyLayer/el/tree/master/packages/bitcoin-listener/README.md)**
   - *Stage:* Proof of Concept

4. **[Bitcoin Wallet (Proof of Concept)](https://github.com/EasyLayer/el/tree/master/packages/bitcoin-wallet/README.md)**
   - *Stage:* Proof of Concept

Click on each link to access detailed descriptions and documentation for each solution. We are continuously developing experimental versions for these applications to enhance their capabilities and stability.

## Prerequisites

- **Node.js:** Version 18 or higher
- **TypeScript:** As the primary programming language

## 🧩 Our Concept

Our solutions are built on the following **principles and technologies**:

- **Node.js & TypeScript:** Ensuring modern, efficient, and type-safe development.
- **NestJS:** Leveraging NestJS for a modern, robust, and scalable software architecture.
- **Architectural Patterns:**
  - **Event Sourcing:** Capturing all changes to an application state as a sequence of events.
  - **Command Query Responsibility Segregation (CQRS):** Separating read and write operations for better scalability and maintainability.
  - **Domain-Driven Design (DDD):** Structuring the software around the business domain for clarity and flexibility.

Developers define **database schemas** and **data storage mechanisms**, then run the applications on their own machines. Our applications communicate via **RPC** to request blocks from their own node or a provider, process the data, and store it in the appropriate database according to the defined schema. This approach ensures that our solutions are **universal** and **adaptable** to any data scheme.
