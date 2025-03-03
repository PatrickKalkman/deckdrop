# DeckDrop: An AI-Powered Connect Three Game for Elgato Stream Deck

![DeckDrop Cover](./images/deckdrop-cover.png)

[![GitHub stars](https://img.shields.io/github/stars/PatrickKalkman/deckdrop)](https://github.com/PatrickKalkman/deckdrop/stargazers)
[![GitHub contributors](https://img.shields.io/github/contributors/PatrickKalkman/deckdrop)](https://github.com/PatrickKalkman/deckdrop/graphs/contributors)
[![GitHub last commit](https://img.shields.io/github/last-commit/PatrickKalkman/deckdrop)](https://github.com/PatrickKalkman/deckdrop)
[![open issues](https://img.shields.io/github/issues/PatrickKalkman/deckdrop)](https://github.com/PatrickKalkman/deckdrop/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://makeapullrequest.com)
[![TypeScript Version](https://img.shields.io/badge/typescript-4.5%2B-blue)](https://www.typescriptlang.org/)

Transform your Elgato Stream Deck into an engaging Connect Three game with intelligent AI opponents. DeckDrop is a unique gaming experience that combines the physical interface of the Stream Deck with advanced AI algorithms.

## ✨ Key Features

- **Complete Connect Three Game**: Play the classic game right on your Stream Deck
- **Dual AI Strategies**: Challenge yourself against two different AI opponents:
  - **Q-Learning AI**: Trained through reinforcement learning
  - **MCTS AI**: Unbeatable Monte Carlo Tree Search algorithm
- **Visual Feedback**: Animated token drops and victory celebrations
- **Configurable Settings**: Choose your player and AI difficulty level
- **Seamless Integration**: Works natively with the Stream Deck hardware

## 🎮 Gameplay

DeckDrop implements a compact 3x5 version of the Connect Three game on the Stream Deck:

- **Game Board**: 3 rows × 5 columns of Stream Deck buttons
- **Objective**: Connect three of your tokens in a row (horizontally, vertically, or diagonally)
- **Players**: Yellow (Player 1) and Red (Player 2)
- **Controls**: Press any button in the top row to drop your token

## 🤖 AI Opponents

### Q-Learning AI
- Uses reinforcement learning to make decisions
- Trained in a separate Python project
- Stores learned strategies in a Q-table
- Provides a moderate challenge for casual players

### Monte Carlo Tree Search (MCTS) AI
- Simulates thousands of potential game states to find optimal moves
- Nearly unbeatable when playing as Player 1
- Configurable simulation count to adjust difficulty
- Uses advanced heuristics for more intelligent gameplay

## 🚀 Installation

1. **Clone the repository**:
```bash
git clone https://github.com/PatrickKalkman/deckdrop
cd deckdrop
```

2. **Install dependencies**:
```bash
npm install
```

3. **Build the plugin**:
```bash
npm run build
```

4. **Install on Stream Deck**:
   - Open the Stream Deck software
   - Drag the compiled `.streamDeckPlugin` file onto the Stream Deck interface
   - Follow the on-screen instructions

## 🛠️ Development

### Prerequisites
- Node.js and npm
- Elgato Stream Deck software
- TypeScript knowledge

### Project Structure
- `ai-opponent.ts`: AI strategy implementation
- `deck-drop-game.ts`: Main game action for Stream Deck
- `game-logic.ts`: Core game rules and state management
- `game-renderer.ts`: Visual representation on Stream Deck
- `mcts-opponent.ts`: Monte Carlo Tree Search implementation
- `win-checker.ts`: Win condition detection

### Building for Development
```bash
npm run dev
```

### Q-Learning Model Training
The Q-Learning model is trained in a separate Python project. The training process:
1. Simulates thousands of games
2. Records successful strategies in a Q-table
3. Exports the Q-table for use in the Stream Deck plugin

## 📊 Technical Details

### Monte Carlo Tree Search Implementation
The MCTS algorithm follows four phases:
1. **Selection**: Navigate from root to leaf node using UCB1 formula
2. **Expansion**: Add a new game state to the tree
3. **Simulation**: Play random moves until game completion
4. **Backpropagation**: Update win rates back up the tree

### AI Strategy Interface
```typescript
interface AIStrategy {
  getBestMove(board: number[][]): number;
  setIsPlayerTwo(isPlayerTwo: boolean): void;
}
```

### Game Board Representation
```typescript
// 3x5 board with:
// 0 = Empty, 1 = Player One (Yellow), 2 = Player Two (Red)
board: number[][] = [
  [0, 0, 0, 0, 0], // Top row
  [0, 0, 0, 0, 0], // Middle row
  [0, 0, 0, 0, 0], // Bottom row
];
```

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🔮 Future Plans

- Support for larger Stream Deck models (e.g., XL)
- Additional AI strategies (e.g., Minimax with Alpha-Beta pruning)
- Multiplayer support across multiple Stream Decks
- Sound effects and haptic feedback
- Custom token themes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Elgato for the Stream Deck SDK
- The game AI community for algorithm inspiration
- All contributors and users who have provided feedback

---

Built with ❤️ for gaming and AI enthusiasts. Star us on GitHub if you find this useful!
