# GoalTracker

[![Project Status: Active](https://img.shields.io/badge/status-active-success.svg)](https://github.com/your-username/goal-tracker)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A web application to help users track, reflect on, and achieve their goals with the help of AI-powered insights.

## Table of Contents
- [Project Description](#project-description)
- [Tech Stack](#tech-stack)
- [Getting Started Locally](#getting-started-locally)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

## Project Description

GoalTracker is a Minimum Viable Product (MVP) designed to help users consistently achieve their goals and learn effectively from their experiences. Unlike traditional to-do list applications, GoalTracker emphasizes the process of reflection, progress analysis, and drawing conclusions. It supports this process through AI-generated summaries that analyze user progress, helping them understand their successes and failures to make better-calibrated attempts at achieving their goals in the future.

## Tech Stack

The project is built with a modern tech stack focused on performance, developer experience, and scalability.

**Frontend:**
- **[Astro](https://astro.build/)**: For building fast, content-focused websites.
- **[React](https://react.dev/)**: For creating interactive UI components.
- **[TypeScript](https://www.typescriptlang.org/)**: For static typing and improved code quality.
- **[Tailwind CSS](https://tailwindcss.com/)**: A utility-first CSS framework for rapid UI development.
- **[Shadcn/ui](https://ui.shadcn.com/)**: A collection of accessible and reusable UI components.

**Backend:**
- **[Supabase](https://supabase.com/)**: An open-source Firebase alternative providing a PostgreSQL database, authentication, and a Backend-as-a-Service SDK.

**AI:**
- **[OpenRouter.ai](https://openrouter.ai/)**: A service to access a wide range of AI models for generating summaries and suggestions.

**CI/CD & Hosting:**
- **[GitHub Actions](https://github.com/features/actions)**: For continuous integration and deployment pipelines.
- **[DigitalOcean](https://www.digitalocean.com/)**: For hosting the application via Docker images.

## Getting Started Locally

To set up and run the project on your local machine, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/goal-tracker.git
    cd goal-tracker
    ```

2.  **Set up the correct Node.js version.**
    This project uses Node.js version `22.14.0`. We recommend using a version manager like `nvm`.
    ```bash
    nvm install
    nvm use
    ```

3.  **Install dependencies:**
    ```bash
    npm install
    ```

4.  **Set up environment variables.**
    Create a `.env` file in the root of the project and add the necessary environment variables (e.g., for Supabase and OpenRouter).
    ```env
    # Example .env file
    PUBLIC_SUPABASE_URL="your-supabase-url"
    PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
    OPENROUTER_API_KEY="your-openrouter-api-key"
    ```

5.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:4321`.

## Available Scripts

The following scripts are available in the `package.json`:

-   `npm run dev`: Starts the development server.
-   `npm run build`: Builds the application for production.
-   `npm run preview`: Previews the production build locally.
-   `npm run lint`: Lints the codebase for errors.
-   `npm run lint:fix`: Automatically fixes linting issues.
-   `npm run format`: Formats the code using Prettier.

## Project Scope

The MVP focuses on the core functionalities required for goal tracking and reflection.

### Key Features:
-   **User Authentication**: Secure registration, login, and logout.
-   **Goal Management**: Create goals with a name, target value, and deadline.
-   **Progress Tracking**: Add numerical progress entries with optional notes.
-   **AI-Powered Summaries**: Receive AI-generated summaries upon goal completion to analyze performance.
-   **AI-Driven Suggestions**: Get suggestions for new goals based on past successes or failures.
-   **Goal Iterations**: Retry failed or abandoned goals with adjusted parameters.
-   **History Tracking**: View the history of all attempts for a given goal.
-   **Progress Visualization**: A clear progress bar and countdown to the deadline.

### Out of Scope for MVP:
-   Social features (friends, activity feeds, sharing).
-   Advanced analytics and long-term dashboards.
-   Third-party integrations (calendars, smartwatches).
-   Gamification (badges, points, leaderboards).
-   Push or email notifications.

## Project Status

This project is currently **in active development**. The core features are being built as part of the MVP.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
