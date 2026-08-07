# Eleven - Football Performance Tracking App

A React Native mobile application for tracking football/soccer training sessions and matches, built with reusable components based on the Eleven Design System.

## Features

- **Authentication Flow**: Sign in with Apple, Google, or Email
- **Profile Setup**: Player profile with position, preferred foot, and stats
- **Session Tracking**: Live tracking for matches, training, and futsal sessions
- **Performance Metrics**: Distance, top speed, sprints, calories, and more
- **The Wall**: Visual progress tracking with session bricks
- **Session Summaries**: Detailed post-session analytics
- **Match Cards**: Shareable session highlights

## Tech Stack

- React Native with Expo
- TypeScript for type safety
- Reusable component library
- Custom design system (Eleven Brand)

## Design System

The app implements the Eleven Design System featuring:

- **Colors**: Dark theme with lime green (#C8F24E) accent
- **Typography**: Archivo (primary) and IBM Plex Mono (monospace)
- **Components**: Buttons, Chips, Fields, Stat Tiles, Status Pills, Wall visualization
- **Spacing**: 4pt grid system with 24px gutter

## Project Structure

```
mobile-app/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── BrandMark.tsx
│   │   ├── Button.tsx
│   │   ├── Chip.tsx
│   │   ├── Field.tsx
│   │   ├── SegmentedControl.tsx
│   │   ├── StatTile.tsx
│   │   ├── StatusPill.tsx
│   │   ├── Wall.tsx
│   │   └── index.ts
│   ├── screens/         # Screen components
│   │   ├── SignInScreen.tsx
│   │   ├── ProfileSetupScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── SessionTypeSheet.tsx
│   │   ├── ActiveSessionScreen.tsx
│   │   ├── SessionSummaryScreen.tsx
│   │   └── index.ts
│   └── theme/          # Design tokens and theme
│       └── index.ts
├── App.tsx             # Main app component
├── index.js            # Entry point
└── package.json

```

## Installation

```bash
# Install dependencies
npm install

# Start the development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Component Library

All components are built to be reusable and follow the Eleven Design System:

### BrandMark
```tsx
<BrandMark size="medium" variant="light" withText />
```

### Button
```tsx
<Button
  title="Start Session"
  onPress={handlePress}
  variant="primary"
  size="large"
/>
```

### Chip
```tsx
<Chip
  label="MATCH"
  selected={isSelected}
  onPress={handlePress}
  variant="filter"
/>
```

### Field
```tsx
<Field
  label="Full Name"
  value={name}
  onChangeText={setName}
  placeholder="Enter your name"
/>
```

### StatTile
```tsx
<StatTile
  label="Top Speed"
  value={31.2}
  subtitle="NEW PERSONAL BEST"
  isRecord
/>
```

### Wall
```tsx
<Wall total={56} built={sessionCount} />
```

## Screen Flow

1. **Sign In** → User authentication
2. **Profile Setup** → Player information (skippable)
3. **Home** → Dashboard with session stats and "The Wall"
4. **Session Type** → Choose match, training, or futsal
5. **Active Session** → Live tracking with real-time metrics
6. **Session Summary** → Post-session analytics and sharing

## Development Notes

- All components use TypeScript for type safety
- Styles follow the design system tokens
- Components are designed to be reusable across screens
- Mock data is used for demonstration (replace with real API calls)
- Location tracking requires permission setup
- Fonts need to be loaded before rendering (Archivo, IBM Plex Mono)

## Next Steps

- Add real GPS tracking integration
- Implement backend API for data persistence
- Add social features and sharing
- Implement History and Profile tab screens
- Add animations and transitions
- Configure app icons and splash screens
- Set up push notifications for session reminders
