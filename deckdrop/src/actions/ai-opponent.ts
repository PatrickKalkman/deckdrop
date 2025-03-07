import streamDeck from "@elgato/streamdeck";
import { EMPTY, PLAYER_ONE, PLAYER_TWO } from "./game-renderer";
import { qTableData } from "./q-table";
import { MCTSOpponent, DEFAULT_MCTS_SIMULATIONS } from "./mcts-opponent";
import { GroqOpponent, DEFAULT_GROQ_MODEL } from "./groq-opponent";

// Define an interface for AI strategies
interface AIStrategy {
  getBestMove(board: number[][]): number | Promise<number>;
  setIsPlayerTwo(isPlayerTwo: boolean): void;
}

// QLearningStrategy implements the existing Q-learning approach
class QLearningStrategy implements AIStrategy {
  private qTable: Record<string, Record<string, number>>;
  public isPlayerTwo: boolean = true;
  
  constructor() {
    this.qTable = qTableData;
    streamDeck.logger.info(`Loaded Q-table with ${Object.keys(this.qTable).length} states`);
  }
  
  public getBestMove(board: number[][]): number {
    // Convert board to state representation
    const state = this.boardToState(board);
    streamDeck.logger.info(`Current state: ${state}`);
    
    // Get valid actions (columns that aren't full)
    const validActions = this.getValidActions(board);
    streamDeck.logger.info(`Valid actions: ${validActions}`);
    
    if (validActions.length === 0) {
      streamDeck.logger.warn('No valid actions available');
      return -1;
    }
    
    // Check if we have this state in our Q-table
    if (!(state in this.qTable)) {
      streamDeck.logger.info(`State not found in Q-table, using column preference`);
      // If state not in Q-table, use column preference heuristic
      // Prefer middle column, then columns near middle, then edges
      const preferenceOrder = [2, 1, 3, 0, 4];
      for (const col of preferenceOrder) {
        if (validActions.includes(col)) {
          return col;
        }
      }
      return validActions[0]; // Fallback to first valid action
    }
    
    // Find best action based on Q-values
    let bestAction = -1;
    let bestValue = -Infinity;
    
    for (const action of validActions) {
      const actionStr = action.toString();
      const qValue = this.qTable[state][actionStr] || 0;
      streamDeck.logger.info(`Q-value for action ${action}: ${qValue}`);
      
      if (qValue > bestValue) {
        bestValue = qValue;
        bestAction = action;
      }
    }
    
    if (bestAction === -1) {
      // If no good move found, fallback to middle column heuristic
      const preferenceOrder = [2, 1, 3, 0, 4];
      for (const col of preferenceOrder) {
        if (validActions.includes(col)) {
          return col;
        }
      }
      return validActions[0]; // Fallback to first valid action
    }
    
    return bestAction;
  }
  
  public setIsPlayerTwo(isPlayerTwo: boolean): void {
    this.isPlayerTwo = isPlayerTwo;
  }
  
  // Helper methods
  private boardToState(board: number[][]): string {
    // If AI is player 2, we don't need to flip the perspective
    if (this.isPlayerTwo) {
      return board.flat().join('');
    }
    
    // If AI is player 1, we need to flip the perspective
    // since the Q-learning was trained with player 1 as the agent
    const flippedBoard = board.map(row => 
      row.map(cell => {
        if (cell === EMPTY) return EMPTY;
        return cell === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
      })
    );
    
    return flippedBoard.flat().join('');
  }
  
  private getValidActions(board: number[][]): number[] {
    const validActions: number[] = [];
    
    // Check top row for each column
    for (let col = 0; col < 5; col++) {
      if (board[0][col] === EMPTY) {
        validActions.push(col);
      }
    }
    
    return validActions;
  }
}

// MCTSStrategy is just a wrapper for our MCTSOpponent
class MCTSStrategy implements AIStrategy {
  private mctsOpponent: MCTSOpponent;
  
  constructor(simulationCount: number = 5000) {
    this.mctsOpponent = new MCTSOpponent(simulationCount);
  }
  
  public getBestMove(board: number[][]): number {
    return this.mctsOpponent.getBestMove(board);
  }
  
  public setIsPlayerTwo(isPlayerTwo: boolean): void {
    this.mctsOpponent.setIsPlayerTwo(isPlayerTwo);
  }
  
  public setSimulationCount(count: number): void {
    this.mctsOpponent.setSimulationCount(count);
  }
}

// GroqStrategy is a wrapper for our GroqOpponent
class GroqStrategy implements AIStrategy {
  private groqOpponent: GroqOpponent;
  
  constructor(apiKey: string = "", model: string = DEFAULT_GROQ_MODEL) {
    this.groqOpponent = new GroqOpponent(apiKey, model);
  }
  
  public async getBestMove(board: number[][]): Promise<number> {
    return await this.groqOpponent.getBestMove(board);
  }
  
  public setIsPlayerTwo(isPlayerTwo: boolean): void {
    this.groqOpponent.setIsPlayerTwo(isPlayerTwo);
  }
  
  public setApiKey(apiKey: string): void {
    this.groqOpponent.initialize(apiKey);
  }
  
  public setModel(model: string): void {
    this.groqOpponent.setModel(model);
  }
}

export class AIOpponent {
  private strategy: AIStrategy;
  public isPlayerTwo: boolean = true; // AI is player 2 by default
  
  constructor(strategyType: 'qlearning' | 'mcts' | 'groq' = 'mcts', 
              options: { mctsSimulations?: number, groqApiKey?: string, groqModel?: string } = {}) {
    // Create the appropriate strategy
    if (strategyType === 'mcts') {
      this.strategy = new MCTSStrategy(options.mctsSimulations || DEFAULT_MCTS_SIMULATIONS);
    } else if (strategyType === 'groq') {
      this.strategy = new GroqStrategy(options.groqApiKey, options.groqModel);
    } else {
      this.strategy = new QLearningStrategy();
    }
    
    streamDeck.logger.info(`Created AI Opponent with ${strategyType} strategy`);
  }
  
  /**
   * Get the best action (column) for the current board state
   * @param board Current game board
   * @returns Column index (0-4) for the best move
   */
  public async getBestMove(board: number[][]): Promise<number> {
    return await Promise.resolve(this.strategy.getBestMove(board));
  }
  
  /**
   * Set which player the AI plays as
   * @param isPlayerTwo true if AI is player 2, false if AI is player 1
   */
  public setIsPlayerTwo(isPlayerTwo: boolean): void {
    this.isPlayerTwo = isPlayerTwo;
    this.strategy.setIsPlayerTwo(isPlayerTwo);
  }
  
  /**
   * Change the AI strategy
   * @param strategyType The type of strategy to use ('qlearning', 'mcts', or 'groq')
   * @param options Additional options for the strategy
   */
  public setStrategy(
    strategyType: 'qlearning' | 'mcts' | 'groq', 
    options: { mctsSimulations?: number, groqApiKey?: string, groqModel?: string } = {}
  ): void {
    if (strategyType === 'mcts') {
      this.strategy = new MCTSStrategy(options.mctsSimulations || DEFAULT_MCTS_SIMULATIONS);
    } else if (strategyType === 'groq') {
      this.strategy = new GroqStrategy(options.groqApiKey, options.groqModel);
    } else {
      this.strategy = new QLearningStrategy();
    }
    
    // Make sure to set the player correctly
    this.strategy.setIsPlayerTwo(this.isPlayerTwo);
    
    streamDeck.logger.info(`Switched to ${strategyType} strategy`);
  }
  
  /**
   * Configure the current strategy with additional options
   * @param options Options specific to the current strategy
   */
  public configureStrategy(options: {
    mctsSimulations?: number,
    groqApiKey?: string,
    groqModel?: string
  }): void {
    if (this.strategy instanceof MCTSStrategy && options.mctsSimulations) {
      (this.strategy as MCTSStrategy).setSimulationCount(options.mctsSimulations);
    } else if (this.strategy instanceof GroqStrategy) {
      if (options.groqApiKey) {
        (this.strategy as GroqStrategy).setApiKey(options.groqApiKey);
      }
      if (options.groqModel) {
        (this.strategy as GroqStrategy).setModel(options.groqModel);
      }
    }
  }
}
