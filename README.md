# Yu-Gi-Oh! Cube Draft Simulator

A web-based cube draft simulator for Yu-Gi-Oh! that brings the beloved draft format from Magic: The Gathering to the world of Yu-Gi-Oh! Draft solo against AI opponents or host multiplayer sessions with friends in real-time.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)

## Features

### Draft Modes
- **Solo Draft**: Practice against 1-11 AI opponents that pick the highest-rated cards
- **Multiplayer Draft**: Real-time drafting with 2-12 players using room codes
- **Customizable Settings**: Configure pack size, cards per player, timer duration, and burn cards

### Card System
- **Tier Ratings**: Cards scored 0-100, displayed as tiers (S/A/B/C/E/F)
- **Card Types**: Full support for all Yu-Gi-Oh! card types including Extra Deck monsters
- **YGOProDeck Integration**: Automatic card data and image fetching

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
- **Dark Theme**: Yu-Gi-Oh! inspired dark purple/gold aesthetic

### Results & Statistics
- **Draft Statistics**: Pick times, auto-pick rate, type distribution
- **Burned Cards**: View cards discarded during the draft
- **YDK Export**: Export your deck for use in simulators

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (for multiplayer)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/yugioh-cube-draft.git
cd yugioh-cube-draft

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

Cubes are defined as CSV files in `public/cubes/`. Each row contains:

```csv
ID,Name,Score
55878038,Chaos Dragon Levianeer,95
82301904,Chaos Emperor Dragon - Envoy of the End,95
89631139,Blue-Eyes White Dragon,85
```

- **ID**: YGOProDeck card ID (required)
- **Name**: Card name (auto-filled by build script)
- **Score**: Rating from 0-100 (determines tier)

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

After editing a CSV file, rebuild the JSON:

```bash
# Build cube JSON from CSV
npm run build:cube

# This will:
# 1. Read public/cubes/*.csv files
# 2. Fetch card data from YGOProDeck API
# 3. Generate public/cubes/*.json files
# 4. Update CSV with full card names
```

### Auto-Rebuild During Development

For convenience during cube editing, use the watch script:

```bash
# Watch for CSV changes and auto-rebuild
npm run watch:cube

# Edit your CSV files and save - JSON rebuilds automatically
```

### Downloading Card Images (Optional)

For offline/faster image loading:

```bash
# Download all card images for a cube
node scripts/download-cube-images.cjs mazcube
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
yugioh-cube-draft/
├── src/
│   ├── pages/              # Route pages (Home, Draft, Results, etc.)
│   ├── components/         # Reusable React components
│   │   ├── ui/            # Base UI components (Button)
│   │   ├── cards/         # Card display components
│   │   ├── layout/        # Layout wrapper
│   │   └── cube/          # Cube browser
│   ├── hooks/             # Custom React hooks
│   │   ├── useDraftSession.ts  # Draft state & Supabase sync
│   │   ├── useCards.ts         # Card data fetching
│   │   └── useImagePreloader.ts # Image preloading
│   ├── services/          # Business logic
│   │   ├── draftService.ts     # Supabase operations
│   │   ├── cubeService.ts      # Cube loading & caching
│   │   ├── cardService.ts      # YGOProDeck API
│   │   └── statisticsService.ts # Pick statistics
│   ├── lib/               # Utilities
│   │   ├── supabase.ts    # Supabase client
│   │   ├── utils.ts       # Helper functions
│   │   └── database.types.ts # TypeScript types
│   └── types/             # Type definitions
├── public/
│   └── cubes/             # Cube CSV and JSON files
├── scripts/               # Build scripts
│   ├── build-cube.cjs     # CSV to JSON builder
│   ├── watch-cubes.cjs    # File watcher
│   └── download-cube-images.cjs # Image downloader
├── supabase/
│   ├── schema.sql         # Database schema
│   └── migrations/        # Database migrations
└── tests/                 # Playwright E2E tests
```

## Draft Mechanics

### Pack Drafting
1. Each player receives a pack of cards
2. Players pick one card from their pack
3. Remaining cards pass to the next player
4. Direction alternates each pack (left, right, left...)

### Burned Cards
Configure "burned per pack" to discard the last N cards of each pack. This adds strategic depth by making late picks less reliable.

### Timer & Auto-Pick
- Configurable timer per pick (default 60s)
- When timer expires, the highest-rated card is auto-picked
- Server-side enforcement prevents stalling

### Pack Direction
- Pack 1: Pass left
- Pack 2: Pass right
- Pack 3: Pass left
- (alternates)

## API & Data Sources

### YGOProDeck API
Card data and images are fetched from [YGOProDeck](https://ygoprodeck.com/):
- Card info: `https://db.ygoprodeck.com/api/v7/cardinfo.php`
- Card images: `https://images.ygoprodeck.com/images/cards/{id}.jpg`
- Small images: `https://images.ygoprodeck.com/images/cards_small/{id}.jpg`

### Supabase
Real-time multiplayer uses Supabase PostgreSQL with Realtime subscriptions:
- `draft_sessions`: Game state, settings, pack data
- `draft_players`: Player info, current hand, connection status
- `draft_picks`: Pick history with timing data
- `draft_burned_cards`: Discarded cards tracking

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` `→` or `↑` `↓` | Navigate cards |
| `1`-`9` | Quick select card |
| `Enter` or `Space` | Pick selected card |
| `Escape` | Deselect card |
| `?` | Toggle shortcuts help |

## Testing

```bash
# Run all tests
npm run test

# Run multiplayer tests only
npm run test:mp
```

Tests use Playwright with Chromium to simulate multi-player draft scenarios.

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Set environment variables in Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Static Hosting

```bash
# Build for production
npm run build

# Serve the dist/ folder
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is for educational and personal use. Yu-Gi-Oh! is a trademark of Konami. Card data provided by YGOProDeck.

## Acknowledgments

- [YGOProDeck](https://ygoprodeck.com/) for card data and images
- [Supabase](https://supabase.com/) for real-time database
- The Yu-Gi-Oh! community for inspiration
