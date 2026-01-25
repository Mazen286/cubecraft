# CubeCraft

A multi-game cube draft simulator for trading card games. Draft solo against AI opponents or host real-time multiplayer sessions with friends.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)

## Supported Games

- **Yu-Gi-Oh!** — Full card type support, YDK export for simulators
- **Magic: The Gathering** — Color identity, MTG Arena export
- **Pokemon TCG** — Energy types, PTCGO export

## Features

### Draft Modes
- **Solo Draft**: Practice against 1-11 AI opponents that pick the highest-rated cards
- **Multiplayer Draft**: Real-time drafting with 2-12 players using room codes
- **Customizable Settings**: Configure pack size, cards per player, timer duration, and burn cards

### Card System
- **Tier Ratings**: Cards scored 0-100, displayed as tiers (S/A/B/C/E/F)
- **Game-Specific Rendering**: Each game has its own card display and categorization
- **API Integration**: Automatic card data and image fetching from game APIs

### Real-Time Multiplayer
- **Room Codes**: 4-character codes for easy joining
- **Synchronized Timers**: All players see the same countdown
- **Pause/Resume**: Host can pause with synced 5-second resume countdown
- **Auto-Pick**: Timeout protection picks the highest-rated card automatically
- **Reconnection**: Players can rejoin mid-draft

### User Experience
- **Mobile Responsive**: Full mobile support with dedicated card viewer drawer
- **Keyboard Shortcuts**: Arrow keys, 1-9 quick select, Enter to pick
- **Drag & Drop**: Drag cards to the drafted pile
- **Image Preloading**: Cards load instantly with background preloading
- **Dark Theme**: Elegant dark theme with gold accents

### Results & Export
- **Draft Statistics**: Pick times, auto-pick rate, type distribution
- **Burned Cards**: View cards discarded during the draft
- **Game-Specific Export**: YDK (Yu-Gi-Oh!), MTG Arena, PTCGO formats

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (for multiplayer)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/cubecraft.git
cd cubecraft

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Environment Variables

Create a `.env` file with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Database Setup

Run the schema in your Supabase SQL Editor:

```bash
# The schema file is located at:
supabase/schema.sql
```

### Development

```bash
# Start development server
npm run dev

# The app will be available at http://localhost:5173
```

## Cube Management

### CSV Format

Cubes are defined as CSV files in `public/cubes/`. Format varies by game:

**Yu-Gi-Oh!:**
```csv
ID,Name,Score
55878038,Chaos Dragon Levianeer,95
```

**MTG:**
```csv
Name,Set,Score
Lightning Bolt,2ED,90
```

**Pokemon:**
```csv
ID,Name,Score
base1-4,Charizard,95
```

### Tier System

| Score Range | Tier | Color |
|-------------|------|-------|
| 95-100 | S | Gold |
| 90-94 | A | Red |
| 75-89 | B | Orange |
| 60-74 | C | Yellow |
| 50-59 | E | Green |
| 0-49 | F | Gray |

### Building Cubes

```bash
# Build Yu-Gi-Oh! cube from CSV
npm run build:cube

# Build MTG cube
node scripts/build-mtg-cube.cjs

# Build Pokemon cube
node scripts/build-pokemon-cube.cjs

# Watch for CSV changes and auto-rebuild
npm run watch:cube
```

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run build:cube` | Build cube JSON from CSV files |
| `npm run watch:cube` | Watch CSV files and auto-rebuild |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Playwright E2E tests |
| `npm run test:mp` | Run multiplayer draft tests |

## Project Structure

```
cubecraft/
├── src/
│   ├── pages/              # Route pages (Home, Draft, Results, etc.)
│   ├── components/         # Reusable React components
│   │   ├── ui/            # Base UI components
│   │   ├── cards/         # Game-specific card displays
│   │   ├── layout/        # Layout wrapper
│   │   ├── auth/          # Authentication components
│   │   └── cube/          # Cube browser & upload
│   ├── config/            # Game configurations
│   │   └── games/         # Per-game settings (yugioh, mtg, pokemon)
│   ├── context/           # React contexts (Game, Auth)
│   ├── hooks/             # Custom React hooks
│   ├── services/          # Business logic & API calls
│   ├── lib/               # Utilities
│   └── types/             # Type definitions
├── public/
│   └── cubes/             # Cube CSV and JSON files
├── scripts/               # Build scripts per game
├── supabase/
│   ├── schema.sql         # Database schema
│   └── migrations/        # Database migrations
└── tests/                 # Playwright E2E tests
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` `→` or `↑` `↓` | Navigate cards |
| `1`-`9` | Quick select card |
| `Enter` or `Space` | Pick selected card |
| `Escape` | Deselect card |
| `?` | Toggle shortcuts help |

## Deployment

### Netlify

1. Connect your GitHub repository
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables in Netlify dashboard

### Vercel

```bash
vercel
```

Set environment variables in Vercel dashboard.

## API & Data Sources

- **Yu-Gi-Oh!**: [YGOProDeck](https://ygoprodeck.com/)
- **MTG**: [Scryfall](https://scryfall.com/)
- **Pokemon**: [Pokemon TCG API](https://pokemontcg.io/)

## License

This project is for educational and personal use. All card game names and logos are trademarks of their respective owners.

## Acknowledgments

- [YGOProDeck](https://ygoprodeck.com/), [Scryfall](https://scryfall.com/), [Pokemon TCG API](https://pokemontcg.io/) for card data
- [Supabase](https://supabase.com/) for real-time database
- The TCG community for inspiration
