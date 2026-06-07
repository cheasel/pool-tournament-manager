# Pool Tournament Organizer
## Technical Project Plan & Architecture

### 1. Project Description
A specialized web platform designed to manage cue sports tournaments (8-Ball, 9-Ball, 10-Ball). The system handles complex, automated handicap logic (dynamic rack races and money-ball spotting) and supports a specific hybrid tournament structure: Qualifying Groups of 8 (Double Elimination) advancing into a final Knockout Bracket (Single Elimination).

### 2. Assumptions & Interpretations (Principle 1)
* **Stack Assumption:** A modern TypeScript-based web stack is proposed to ensure type safety for complex bracket logic and allow sharing code between the frontend and backend.
* **Scope Assumption:** Built for administrative use first. Features like player-facing dashboards or live score casting are deferred to keep the initial build surgical and simple.

### 3. Recommended Tech Stack (Principle 2)
Keeping simplicity first, we avoid overengineered microservices and stick to a robust monolith or Backend-as-a-Service approach.
* **Frontend & Backend:** `Next.js (React)` - Build UI and backend API routes in a single repository.
* **Language:** `TypeScript` - Critical for ensuring the handicap math and bracket logic remain bug-free.
* **Database:** `Supabase (PostgreSQL)` - Instant relational database setup and authentication without complex boilerplate.
* **Styling:** `Tailwind CSS` - Minimum code required to build clean, responsive bracket interfaces.
* **Hosting:** `Vercel` - Zero-configuration deployment for Next.js.

### 4. Goal-Driven Execution Plan (Principle 4)
The project will be built in four surgical phases, each with strict verifiable success criteria.

#### Phase 1: Core Logic & Schema
Implement the database tables and the core mathematical logic for handicaps.
* **Verify:** Unit tests pass for the `calculateMatchHandicap` function. Schema successfully deployed with Players, Tournaments, and Matches tables.

#### Phase 2: Tournament & Group Setup
Build the UI to create a tournament, register players, and split them into groups of 8.
* **Verify:** User can input 32 players and the system successfully chunks them into 4 isolated groups of 8 in the database.

#### Phase 3: The Hybrid Bracket Engine
Implement the Double Elimination structure for the groups, and the logic to extract 4 winners (2 from Winner's side, 2 from Loser's side) into the final Single Elimination knockout.
* **Verify:** Simulating a group's matches automatically advances the correct 4 players into opposite sides of a new knockout bracket.

#### Phase 4: Match Execution & Admin UI
Create the specific match view where an admin inputs the score. The UI must display the target race and any active money balls for the match.
* **Verify:** Submitting a score of 6-3 (where target was 6-3) automatically closes the match and advances the winner in the UI bracket.
